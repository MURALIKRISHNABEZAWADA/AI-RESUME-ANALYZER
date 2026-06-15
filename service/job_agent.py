"""Supervised job application automation planning logic."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import urlparse

from service.ats_service import get_candidate_name, get_role_title, optimize_resume, title_case


@dataclass(frozen=True)
class ApplicationField:
    label: str
    suggested_value: str
    status: str
    source: str


@dataclass(frozen=True)
class ApplicationStep:
    title: str
    detail: str
    status: str


@dataclass(frozen=True)
class ApplicationBlocker:
    title: str
    detail: str
    severity: str


def _clamp(value: int, minimum: int = 0, maximum: int = 100) -> int:
    return min(max(value, minimum), maximum)


def _first_match(pattern: str, text: str) -> str:
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else ""


def _extract_contact_value(resume: str, kind: str) -> str:
    patterns = {
        "email": r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})",
        "phone": r"(\+?\d[\d\s().-]{7,}\d)",
        "linkedin": r"((?:https?://)?(?:www\.)?linkedin\.com/[^\s|,]+)",
        "portfolio": r"((?:https?://)?(?:www\.)?(?:github\.com|[a-z0-9.-]+\.[a-z]{2,})/[^\s|,]+)",
    }
    return _first_match(patterns[kind], resume)


def _company_from_url(job_url: str) -> str:
    host = urlparse(job_url).netloc.lower().removeprefix("www.")
    if not host:
        return ""
    parts = [part for part in host.split(".") if part not in {"jobs", "careers", "apply", "greenhouse", "lever"}]
    return title_case(parts[0].replace("-", " ")) if parts else ""


def _extract_company(job_description: str, job_url: str, supplied_company: str) -> str:
    if supplied_company.strip():
        return supplied_company.strip()

    for line in job_description.splitlines()[:12]:
        match = re.search(r"^(?:company|organization|employer)\s*:?\s*(.+)$", line.strip(), re.IGNORECASE)
        if match:
            return match.group(1).strip()[:80]

    return _company_from_url(job_url)


def _has_placeholder(text: str) -> bool:
    return bool(
        re.search(
            r"Degree or Certification|Current or Most Relevant Role|Add a truthful|Add a role-relevant|Your Name|Email \| Phone",
            text,
            re.IGNORECASE,
        )
    )


def _build_cover_letter(
    candidate_name: str,
    role_title: str,
    company: str,
    matched_keywords: list[str],
    applicant_notes: str,
) -> str:
    company_line = company or "your team"
    top_keywords = ", ".join(title_case(keyword) for keyword in matched_keywords[:4]) or "the role's core requirements"
    note_sentence = f" I would also highlight: {applicant_notes.strip()}" if applicant_notes.strip() else ""

    return "\n".join(
        [
            f"Dear {company_line} hiring team,",
            "",
            (
                f"I am excited to apply for the {role_title} role. My background aligns with {top_keywords}, "
                "and I bring a practical track record of turning requirements into reliable outcomes."
            ),
            "",
            (
                "In this application, I would emphasize verified accomplishments from my resume, connect them directly "
                f"to {company_line}'s needs, and keep the materials concise for both recruiters and ATS systems."
                f"{note_sentence}"
            ),
            "",
            "Thank you for your time and consideration. I would welcome the opportunity to discuss how my experience can help your team.",
            "",
            f"Sincerely,\n{candidate_name}",
        ]
    )


def _field(label: str, value: str, source: str, review_when_present: bool = False) -> ApplicationField:
    if not value:
        return ApplicationField(label, "Needs manual input", "missing", source)
    return ApplicationField(label, value, "review" if review_when_present else "ready", source)


def build_application_plan(
    master_resume: str,
    job_description: str,
    job_url: str = "",
    company_name: str = "",
    role_title: str = "",
    applicant_notes: str = "",
) -> dict[str, Any]:
    """Create a supervised application packet and checklist for a target role."""

    clean_resume = master_resume.strip()
    clean_job_description = job_description.strip()
    if not clean_resume or not clean_job_description:
        raise ValueError("Both master_resume and job_description are required.")

    optimized = optimize_resume(clean_resume, clean_job_description, include_pdf=False)
    candidate_name = get_candidate_name(clean_resume)
    resolved_role = role_title.strip() or get_role_title(clean_job_description)
    company = _extract_company(clean_job_description, job_url.strip(), company_name)
    email = _extract_contact_value(clean_resume, "email")
    phone = _extract_contact_value(clean_resume, "phone")
    linkedin = _extract_contact_value(clean_resume, "linkedin")
    portfolio = _extract_contact_value(clean_resume, "portfolio")
    optimized_resume_text = str(optimized["optimized_resume_text"])
    has_placeholder = _has_placeholder(optimized_resume_text)
    missing_keywords = list(optimized["missing_keywords"])
    matched_keywords = list(optimized["matched_keywords"])

    blockers: list[ApplicationBlocker] = []
    if int(optimized["ats_match_score"]) < 60:
        blockers.append(
            ApplicationBlocker(
                "Resume match is below apply-ready threshold",
                "Improve the tailored resume before applying so the application better reflects the job description.",
                "high",
            )
        )
    if not email or not phone:
        blockers.append(
            ApplicationBlocker(
                "Contact details need review",
                "Add a professional email address and phone number before submitting an application.",
                "high",
            )
        )
    if has_placeholder:
        blockers.append(
            ApplicationBlocker(
                "Tailored resume contains placeholders",
                "Replace generated placeholders with verified experience, education, dates, and accomplishments.",
                "high",
            )
        )
    if not job_url.strip():
        blockers.append(
            ApplicationBlocker(
                "Job posting URL is missing",
                "Add the job URL so the agent can track the source and prepare a clean application packet.",
                "medium",
            )
        )
    if missing_keywords:
        blockers.append(
            ApplicationBlocker(
                "Missing job-description keywords",
                f"Add truthful evidence for: {', '.join(title_case(keyword) for keyword in missing_keywords[:6])}.",
                "medium",
            )
        )

    readiness = int(optimized["ats_match_score"])
    readiness -= 15 if not email else 0
    readiness -= 15 if not phone else 0
    readiness -= 10 if has_placeholder else 0
    readiness -= 8 if not job_url.strip() else 0
    readiness -= 6 if not company else 0
    readiness -= 8 if len(missing_keywords) > 10 else 0
    readiness_score = _clamp(readiness)

    field_checklist = [
        _field("Full name", candidate_name, "resume"),
        _field("Email", email, "resume"),
        _field("Phone", phone, "resume"),
        _field("LinkedIn", linkedin, "resume", review_when_present=True),
        _field("Portfolio or GitHub", portfolio, "resume", review_when_present=True),
        _field("Target role", resolved_role, "job description"),
        _field("Company", company, "job description or job URL"),
        _field("Job posting URL", job_url.strip(), "user input"),
        _field("Tailored resume", "Optimized resume draft is ready to review", "ATS optimizer", has_placeholder),
        _field("Cover letter", "Generated cover letter draft is ready to review", "application agent", True),
    ]
    steps = [
        ApplicationStep(
            "Verify job source",
            "Confirm the company, role title, and job posting URL are correct before using any application materials.",
            "ready" if job_url.strip() and company else "needs_review",
        ),
        ApplicationStep(
            "Finalize tailored resume",
            "Replace placeholders and add truthful accomplishments for the missing keywords before uploading.",
            "needs_review" if has_placeholder or missing_keywords else "ready",
        ),
        ApplicationStep(
            "Review generated answers",
            "Check every suggested application field for accuracy, especially links, authorization, salary, and availability.",
            "needs_review",
        ),
        ApplicationStep(
            "Submit manually",
            "Use the packet to fill the job board, then submit only after a final human review.",
            "needs_review",
        ),
    ]
    cover_letter = _build_cover_letter(candidate_name, resolved_role, company, matched_keywords, applicant_notes)
    recruiter_message = (
        f"Hi, I am interested in the {resolved_role} role"
        f"{f' at {company}' if company else ''}. My background aligns with "
        f"{', '.join(title_case(keyword) for keyword in matched_keywords[:3]) or 'the role requirements'}, "
        "and I would appreciate the chance to share more."
    )

    return {
        "mode": "supervised",
        "readiness_score": readiness_score,
        "status": "Ready for final review" if readiness_score >= 75 and not any(item.severity == "high" for item in blockers) else "Needs review",
        "role_title": resolved_role,
        "company_name": company,
        "job_url": job_url.strip(),
        "summary": (
            "The agent prepared a tailored application packet, highlighted blockers, and generated materials for manual review. "
            "It does not submit applications automatically."
        ),
        "field_checklist": [asdict(field) for field in field_checklist],
        "blockers": [asdict(blocker) for blocker in blockers],
        "steps": [asdict(step) for step in steps],
        "cover_letter": cover_letter,
        "recruiter_message": recruiter_message,
        "optimized_resume_text": optimized_resume_text,
        "missing_keywords": missing_keywords,
        "matched_keywords": matched_keywords,
        "ats_match_score": optimized["ats_match_score"],
    }
