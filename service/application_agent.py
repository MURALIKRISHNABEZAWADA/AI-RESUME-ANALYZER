"""Job application automation package generator.

This module keeps the workflow deterministic and local: it prepares the
materials and answers a candidate needs for an application, but it does not
store credentials or submit applications on the user's behalf.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any
from urllib.parse import urlparse

from service.ats_service import optimize_resume, title_case

REQUIRED_PROFILE_FIELDS = [
    ("full_name", "Full legal or preferred name"),
    ("email", "Professional email address"),
    ("phone", "Phone number"),
    ("location", "Current location"),
    ("linkedin", "LinkedIn profile URL"),
    ("work_authorization", "Work authorization status"),
]


def _clean_text(value: object) -> str:
    return str(value or "").strip()


def _clean_profile(profile: dict[str, Any] | None) -> dict[str, str]:
    if not isinstance(profile, dict):
        return {}
    return {str(key): _clean_text(value) for key, value in profile.items() if _clean_text(value)}


def _extract_role_title(job_description: str) -> str:
    title_match = re.search(r"(?:job\s*title|role|position)\s*:?\s*([^\n.]+)", job_description, re.IGNORECASE)
    if title_match:
        return title_match.group(1).strip()[:80]
    for line in (line.strip() for line in job_description.splitlines()):
        if 8 < len(line) < 80 and not re.search(r"[.!?]$", line):
            return line
    return "Target Role"


def _extract_company(job_description: str, job_url: str, company_name: str) -> str:
    if company_name:
        return company_name[:80]

    company_match = re.search(r"(?:company|organization|employer)\s*:?\s*([^\n.]+)", job_description, re.IGNORECASE)
    if company_match:
        return company_match.group(1).strip()[:80]

    hostname = urlparse(job_url).hostname or ""
    parts = [part for part in hostname.replace("www.", "").split(".") if part]
    if parts:
        return title_case(parts[0].replace("-", " "))

    return "Target Company"


def _profile_label(profile: dict[str, str], key: str, fallback: str) -> str:
    return profile.get(key, fallback)


def _missing_profile_fields(profile: dict[str, str]) -> list[dict[str, str]]:
    return [{"field": field, "label": label} for field, label in REQUIRED_PROFILE_FIELDS if not profile.get(field)]


def _recommendation(ats_score: int, missing_profile_count: int, missing_keyword_count: int) -> str:
    if ats_score >= 75 and missing_profile_count <= 1:
        return "Apply now"
    if ats_score >= 55:
        return "Apply after quick edits"
    if missing_keyword_count >= 16:
        return "Research fit before applying"
    return "Apply after resume tailoring"


def _readiness_score(ats_score: int, missing_profile_count: int, missing_keyword_count: int) -> int:
    profile_penalty = missing_profile_count * 6
    keyword_penalty = min(missing_keyword_count, 12)
    return max(0, min(100, round((ats_score * 0.78) + 22 - profile_penalty - keyword_penalty)))


def _build_checklist(
    optimized: dict[str, Any],
    missing_profile: list[dict[str, str]],
    job_url: str,
) -> list[dict[str, str]]:
    missing_keywords = optimized["missing_keywords"][:5]
    checklist = [
        {
            "task": "Review the ATS-optimized resume",
            "status": "ready" if optimized["ats_match_score"] >= 70 else "needs-work",
            "detail": "Replace placeholders with verified experience before uploading.",
        },
        {
            "task": "Add missing job keywords truthfully",
            "status": "ready" if not missing_keywords else "needs-work",
            "detail": ", ".join(title_case(keyword) for keyword in missing_keywords) or "Keyword coverage looks strong.",
        },
        {
            "task": "Complete candidate profile fields",
            "status": "ready" if not missing_profile else "blocked",
            "detail": ", ".join(item["label"] for item in missing_profile) or "Core profile fields are present.",
        },
        {
            "task": "Open the application page",
            "status": "ready" if job_url else "needs-work",
            "detail": job_url or "Add the job posting URL so the tracker can point to the right application.",
        },
        {
            "task": "Save evidence after submitting",
            "status": "todo",
            "detail": "Capture confirmation number, application date, and recruiter contact if available.",
        },
    ]
    return checklist


def _build_form_answers(profile: dict[str, str], role_title: str, company: str, optimized: dict[str, Any]) -> dict[str, str]:
    skills = [title_case(keyword) for keyword in optimized["matched_keywords"][:8]]
    missing = [title_case(keyword) for keyword in optimized["missing_keywords"][:5]]
    work_auth = _profile_label(profile, "work_authorization", "Add your work authorization status")
    sponsorship = _profile_label(profile, "sponsorship", "Add whether you require sponsorship")

    return {
        "Full name": _profile_label(profile, "full_name", "Add your full name"),
        "Email": _profile_label(profile, "email", "Add your professional email"),
        "Phone": _profile_label(profile, "phone", "Add your phone number"),
        "Location": _profile_label(profile, "location", "Add your current city and state/country"),
        "LinkedIn": _profile_label(profile, "linkedin", "Add your LinkedIn profile URL"),
        "Portfolio": _profile_label(profile, "portfolio", "Add portfolio or GitHub URL if relevant"),
        "Work authorization": work_auth,
        "Sponsorship": sponsorship,
        "Salary expectations": _profile_label(profile, "salary_expectation", "Flexible based on role scope and total compensation."),
        "Notice period": _profile_label(profile, "notice_period", "Add your earliest available start date or notice period."),
        "Why are you interested?": (
            f"I am interested in the {role_title} role at {company} because it aligns with my experience in "
            f"{', '.join(skills[:4]) or 'the responsibilities described in the posting'}."
        ),
        "Top relevant skills": ", ".join(skills) or "Add the skills that honestly match your experience.",
        "Keywords to address before submitting": ", ".join(missing) or "No high-priority gaps detected.",
    }


def _build_cover_letter(profile: dict[str, str], role_title: str, company: str, optimized: dict[str, Any]) -> str:
    name = _profile_label(profile, "full_name", "Your Name")
    matched = [title_case(keyword) for keyword in optimized["matched_keywords"][:5]]
    strengths = optimized["strengths"][:2]
    improvements = optimized["improvements"][:1]

    body_lines = [
        f"Dear {company} Hiring Team,",
        "",
        f"I am excited to apply for the {role_title} role at {company}. My background aligns with "
        f"{', '.join(matched) or 'the responsibilities in the job description'}, and I am motivated by the opportunity to contribute quickly.",
        "",
        f"{strengths[0] if strengths else 'I bring practical experience, clear communication, and a focus on measurable outcomes.'}",
        f"{strengths[1] if len(strengths) > 1 else 'I would welcome the chance to connect my experience to your team priorities in an interview.'}",
        "",
        f"Before submitting, I will {improvements[0].lower() if improvements else 'review the resume for accuracy and role-specific evidence.'}",
        "",
        "Thank you for your time and consideration.",
        "",
        f"Sincerely,\n{name}",
    ]
    return "\n".join(body_lines)


def _build_recruiter_message(profile: dict[str, str], role_title: str, company: str, optimized: dict[str, Any]) -> str:
    name = _profile_label(profile, "full_name", "Your Name")
    matched = [title_case(keyword) for keyword in optimized["matched_keywords"][:3]]
    return (
        f"Hi, I am {name}. I am applying for the {role_title} role at {company} and noticed a strong fit with "
        f"{', '.join(matched) or 'the role requirements'}. I would appreciate the opportunity to share how my experience "
        "maps to the team needs. Thank you for considering my application."
    )


def _build_follow_up_plan(company: str) -> list[dict[str, str]]:
    return [
        {
            "when": "Submission day",
            "action": "Save the confirmation email, application ID, role title, resume version, and job URL.",
        },
        {
            "when": "3 business days after applying",
            "action": f"Send a short LinkedIn or email note to a recruiter or hiring contact at {company}.",
        },
        {
            "when": "7 business days after applying",
            "action": "Follow up once with the recruiter message if there has been no response.",
        },
        {
            "when": "14 business days after applying",
            "action": "Move the application to nurture or closed unless there is active communication.",
        },
    ]


def build_application_package(
    master_resume: str,
    job_description: str,
    *,
    candidate_profile: dict[str, Any] | None = None,
    job_url: str = "",
    company_name: str = "",
    include_pdf: bool = True,
) -> dict[str, Any]:
    """Create an application package for one target job."""

    clean_resume = master_resume.strip()
    clean_job_description = job_description.strip()
    if not clean_resume or not clean_job_description:
        raise ValueError("Both master_resume and job_description are required.")

    profile = _clean_profile(candidate_profile)
    optimized = optimize_resume(clean_resume, clean_job_description, include_pdf=include_pdf)
    role_title = _extract_role_title(clean_job_description)
    company = _extract_company(clean_job_description, job_url, company_name.strip())
    missing_profile = _missing_profile_fields(profile)
    application_id = hashlib.sha1(f"{company}|{role_title}|{job_url}|{profile.get('email', '')}".encode("utf-8")).hexdigest()[:10]
    readiness_score = _readiness_score(
        int(optimized["ats_match_score"]),
        len(missing_profile),
        len(optimized["missing_keywords"]),
    )

    return {
        "application_id": application_id,
        "company": company,
        "role_title": role_title,
        "job_url": job_url,
        "readiness_score": readiness_score,
        "recommendation": _recommendation(
            int(optimized["ats_match_score"]),
            len(missing_profile),
            len(optimized["missing_keywords"]),
        ),
        "missing_profile_fields": missing_profile,
        "checklist": _build_checklist(optimized, missing_profile, job_url),
        "suggested_form_answers": _build_form_answers(profile, role_title, company, optimized),
        "cover_letter": _build_cover_letter(profile, role_title, company, optimized),
        "recruiter_message": _build_recruiter_message(profile, role_title, company, optimized),
        "follow_up_plan": _build_follow_up_plan(company),
        "tracker": {
            "stage": "ready-to-apply" if readiness_score >= 75 and not missing_profile else "prep-needed",
            "next_action": "Submit application" if readiness_score >= 75 and not missing_profile else "Resolve checklist blockers",
            "resume_version": f"{company} - {role_title} ATS resume",
        },
        "optimized_resume": optimized,
    }
