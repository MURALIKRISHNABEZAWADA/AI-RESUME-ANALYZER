"""Human-in-the-loop job application planning logic."""

from __future__ import annotations

import re
from typing import Any

from service.ats_service import get_candidate_name, optimize_resume, title_case


def _clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return min(max(value, minimum), maximum)


def _first_match(text: str, pattern: str) -> str:
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else ""


def _infer_role_title(job_description: str, fallback: str = "") -> str:
    if fallback.strip():
        return fallback.strip()
    explicit_title = _first_match(job_description, r"(?:job\s*title|role|position)\s*:?\s*([^\n.]+)")
    if explicit_title:
        return explicit_title[:80]
    for line in (line.strip() for line in job_description.splitlines()):
        if 8 < len(line) < 80 and not re.search(r"[.!?]$", line):
            return line
    return "Target Role"


def _infer_company_name(job_description: str, fallback: str = "") -> str:
    if fallback.strip():
        return fallback.strip()
    return _first_match(job_description, r"(?:company|employer|organization)\s*:?\s*([^\n.]+)")[:80] or "Target Company"


def _infer_portal_type(job_url: str) -> str:
    normalized_url = job_url.lower()
    if not normalized_url:
        return "Manual or unknown portal"
    if "greenhouse.io" in normalized_url:
        return "Greenhouse"
    if "lever.co" in normalized_url:
        return "Lever"
    if "workday" in normalized_url:
        return "Workday"
    if "linkedin.com" in normalized_url:
        return "LinkedIn"
    if "indeed.com" in normalized_url:
        return "Indeed"
    return "Company careers site"


def _readiness_level(score: int) -> str:
    if score >= 85:
        return "Ready to review and submit"
    if score >= 70:
        return "Nearly ready"
    if score >= 55:
        return "Needs targeted edits"
    return "Not ready yet"


def _contact_value(resume: str, pattern: str, fallback: str) -> str:
    return _first_match(resume, pattern) or fallback


def _field_map(resume: str, role_title: str, company_name: str) -> list[dict[str, str]]:
    email = _contact_value(resume, r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", "Add email")
    phone = _contact_value(resume, r"(\+?\d[\d\s().-]{7,}\d)", "Add phone")
    linkedin = _contact_value(resume, r"(linkedin\.com/[^\s|]+)", "Add LinkedIn URL")
    portfolio = _contact_value(
        resume,
        r"((?:https?://)?(?:github\.com|[\w.-]+portfolio[\w.-]*)/?[^\s|]*)",
        "Add portfolio URL",
    )

    return [
        {"label": "Full name", "value": get_candidate_name(resume), "source": "Resume header", "confidence": "medium"},
        {
            "label": "Email",
            "value": email,
            "source": "Resume contact details",
            "confidence": "needs-review" if email == "Add email" else "high",
        },
        {
            "label": "Phone",
            "value": phone,
            "source": "Resume contact details",
            "confidence": "needs-review" if phone == "Add phone" else "high",
        },
        {
            "label": "LinkedIn",
            "value": linkedin,
            "source": "Resume contact details",
            "confidence": "needs-review" if linkedin == "Add LinkedIn URL" else "high",
        },
        {
            "label": "Portfolio",
            "value": portfolio,
            "source": "Resume contact details",
            "confidence": "needs-review" if portfolio == "Add portfolio URL" else "medium",
        },
        {"label": "Target role", "value": role_title, "source": "Job description", "confidence": "medium"},
        {
            "label": "Company",
            "value": company_name,
            "source": "Application details",
            "confidence": "needs-review" if company_name == "Target Company" else "medium",
        },
        {
            "label": "Work authorization",
            "value": "Review and answer manually",
            "source": "Candidate-only answer",
            "confidence": "needs-review",
        },
        {
            "label": "Salary expectations",
            "value": "Review and answer manually",
            "source": "Candidate-only answer",
            "confidence": "needs-review",
        },
    ]


def _keyword_sentence(keywords: list[str]) -> str:
    return ", ".join(title_case(keyword) for keyword in keywords[:4]) or "the responsibilities described in the posting"


def _checklist(result: dict[str, Any], has_job_url: bool, has_company: bool) -> list[dict[str, str]]:
    tasks = [
        {
            "title": "Review tailored resume draft",
            "detail": "Replace placeholders with verified accomplishments and keep the single-column ATS format.",
            "priority": "required",
        },
        {
            "title": "Confirm application profile fields",
            "detail": "Check contact details, links, location preferences, work authorization, and any required questions before submitting.",
            "priority": "required",
        },
    ]

    missing_keywords = result["missing_keywords"]
    if missing_keywords:
        tasks.append(
            {
                "title": "Close keyword gaps truthfully",
                "detail": f"Add evidence for {', '.join(title_case(keyword) for keyword in missing_keywords[:5])} if those skills are accurate.",
                "priority": "recommended",
            }
        )

    ats_issues = result["ats_issues"]
    if ats_issues:
        tasks.append(
            {
                "title": "Resolve ATS issues",
                "detail": ats_issues[0]["detail"],
                "priority": "required" if any(issue["severity"] == "major" for issue in ats_issues) else "recommended",
            }
        )

    if not has_company:
        tasks.append(
            {
                "title": "Add company context",
                "detail": "Enter the company name so the cover letter and outreach drafts are specific.",
                "priority": "recommended",
            }
        )
    if not has_job_url:
        tasks.append(
            {
                "title": "Attach the job posting URL",
                "detail": "Save the canonical job URL so you can return to the same application and track status.",
                "priority": "optional",
            }
        )

    tasks.append(
        {
            "title": "Manual submit checkpoint",
            "detail": "Open the portal, paste verified fields, upload final documents, and submit only after reviewing the preview page.",
            "priority": "required",
        }
    )
    return tasks


def _cover_letter(
    candidate_name: str,
    company_name: str,
    role_title: str,
    recruiter_name: str,
    result: dict[str, Any],
) -> str:
    greeting = f"Dear {recruiter_name.strip()}," if recruiter_name.strip() else "Hello,"
    strengths = " ".join(result["strengths"][:2])
    keyword_sentence = _keyword_sentence([*result["matched_keywords"], *result["missing_keywords"]])
    return "\n\n".join(
        [
            greeting,
            (
                f"I am excited to apply for the {role_title} role at {company_name}. My background aligns with "
                f"{keyword_sentence}, and I am especially interested in contributing practical, measurable outcomes for this team."
            ),
            (
                f"{strengths} I would bring that same focus to the priorities in your posting while continuing to learn the domain, "
                "collaborate clearly, and deliver reliable work."
            ),
            "I have attached a tailored resume for your review. Thank you for considering my application.",
            f"Sincerely,\n{candidate_name}",
        ]
    )


def _risks(result: dict[str, Any]) -> list[dict[str, str]]:
    risks: list[dict[str, str]] = []
    if result["ats_match_score"] < 65:
        risks.append(
            {
                "title": "Low role match",
                "detail": "The resume may need stronger evidence before this application is worth submitting.",
                "level": "high",
            }
        )
    if len(result["missing_keywords"]) > 8:
        risks.append(
            {
                "title": "Many missing job keywords",
                "detail": "Avoid keyword stuffing; add only accurate examples that reflect real experience.",
                "level": "medium",
            }
        )
    if any(issue["severity"] == "major" for issue in result["ats_issues"]):
        risks.append(
            {
                "title": "Major ATS issue",
                "detail": "Fix major parser or contact-detail issues before uploading documents.",
                "level": "high",
            }
        )
    risks.append(
        {
            "title": "Human review required",
            "detail": "This agent prepares drafts and field suggestions but does not submit applications or bypass portal review screens.",
            "level": "low",
        }
    )
    return risks


def _packet(plan: dict[str, Any]) -> str:
    lines = [
        f"APPLICATION PACKET: {plan['role_title']} at {plan['company_name']}",
        f"Status: {plan['status']}",
        f"Portal: {plan['portal_type']}",
        f"URL: {plan['job_url'] or 'Add job URL'}",
        f"Readiness: {plan['readiness_score']}/100 - {plan['readiness_level']}",
        "",
        "NEXT STEP",
        plan["next_step"],
        "",
        "CHECKLIST",
        *[f"- [{task['priority']}] {task['title']}: {task['detail']}" for task in plan["checklist"]],
        "",
        "FIELD MAP",
        *[f"- {field['label']}: {field['value']} ({field['confidence']}, {field['source']})" for field in plan["field_map"]],
        "",
        "COVER LETTER DRAFT",
        plan["cover_letter"],
        "",
        "OUTREACH MESSAGE",
        plan["outreach_message"],
        "",
        "FOLLOW-UP MESSAGE",
        plan["follow_up_message"],
        "",
        "TAILORED RESUME DRAFT",
        plan["optimized_resume_text"],
    ]
    return "\n".join(lines)


def plan_application(
    master_resume: str,
    job_description: str,
    company_name: str = "",
    role_title: str = "",
    job_url: str = "",
    recruiter_name: str = "",
) -> dict[str, Any]:
    """Create a safe application packet without submitting to third-party portals."""

    result = optimize_resume(master_resume, job_description, include_pdf=False)
    clean_resume = master_resume.strip()
    role = _infer_role_title(job_description, role_title)
    company = _infer_company_name(job_description, company_name)
    candidate_name = get_candidate_name(clean_resume)
    clean_job_url = job_url.strip()
    checklist = _checklist(result, bool(clean_job_url), company != "Target Company")
    unresolved_required_tasks = len([task for task in checklist if task["priority"] == "required"])
    readiness_score = round(
        _clamp(result["ats_match_score"] * 0.7 + result["ats_readiness"] * 0.15 + (100 - unresolved_required_tasks * 8) * 0.15)
    )
    readiness_level = _readiness_level(readiness_score)
    status = "ready" if readiness_score >= 85 else "draft"
    outreach_message = (
        f"Hi, I am applying for the {role} role at {company}. My experience lines up with "
        f"{_keyword_sentence(result['matched_keywords'])}, and I would appreciate any guidance on the team or hiring process. "
        f"Thank you - {candidate_name}"
    )
    follow_up_message = (
        f"Hello, I wanted to follow up on my application for the {role} role at {company}. "
        f"I remain interested in the opportunity and would be glad to share any additional information. Thank you - {candidate_name}"
    )

    plan: dict[str, Any] = {
        "role_title": role,
        "company_name": company,
        "portal_type": _infer_portal_type(clean_job_url),
        "job_url": clean_job_url,
        "readiness_score": readiness_score,
        "readiness_level": readiness_level,
        "next_step": (
            "Review the generated packet, open the portal, and manually submit the verified materials."
            if readiness_score >= 85
            else "Complete the required checklist items before submitting this application."
        ),
        "status": status,
        "checklist": checklist,
        "field_map": _field_map(clean_resume, role, company),
        "cover_letter": _cover_letter(candidate_name, company, role, recruiter_name, result),
        "outreach_message": outreach_message,
        "follow_up_message": follow_up_message,
        "risks": _risks(result),
        "optimized_resume_text": result["optimized_resume_text"],
        "ats_match_score": result["ats_match_score"],
        "grade": result["grade"],
        "keyword_coverage": result["keyword_coverage"],
        "ats_readiness": result["ats_readiness"],
        "matched_keywords": result["matched_keywords"],
        "missing_keywords": result["missing_keywords"],
    }
    plan["application_packet"] = _packet(plan)
    return plan

