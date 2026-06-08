"""Job application packet generator built on top of ATS optimization."""

from __future__ import annotations

import hashlib
import re
from typing import Any
from urllib.parse import urlparse

from service.ats_service import get_candidate_name, get_role_title, optimize_resume, title_case


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#.\s-]", " ", value.lower().replace("&", " and "))).strip()


def _clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return min(max(value, minimum), maximum)


def _infer_company_name(company_name: str, job_url: str, job_description: str) -> str:
    if company_name.strip():
        return company_name.strip()

    host = urlparse(job_url).hostname or ""
    if host:
        return title_case(host.removeprefix("www.").split(".")[0])

    company_match = re.search(r"(?:company|employer|organization)\s*:?\s*([^\n.]+)", job_description, re.IGNORECASE)
    if company_match:
        return company_match.group(1).strip()[:80]

    return "Target Company"


def _application_id(company_name: str, role_title: str) -> str:
    digest = hashlib.sha1(_normalize(f"{company_name}-{role_title}").encode("utf-8")).hexdigest()[:8].upper()
    return f"APP-{digest}"


def _profile_has_any(profile_notes: str, terms: list[str]) -> bool:
    normalized_profile = _normalize(profile_notes)
    return any(_normalize(term) in normalized_profile for term in terms)


def _build_checklist(optimization: dict[str, Any], profile_notes: str) -> list[dict[str, Any]]:
    missing_keywords = optimization["missing_keywords"]
    keyword_hint = ", ".join(title_case(keyword) for keyword in missing_keywords[:4]) or "the highest-value JD terms"
    return [
        {
            "title": "Tailor resume",
            "detail": f"Review the generated resume and add truthful evidence for {keyword_hint}.",
            "done": optimization["ats_match_score"] >= 75 and len(missing_keywords) <= 8,
        },
        {
            "title": "Confirm application details",
            "detail": "Verify work authorization, location preference, compensation expectations, availability, and sponsorship answers before submitting.",
            "done": len(profile_notes.strip()) > 40,
        },
        {
            "title": "Prepare portal assets",
            "detail": "Save the tailored resume as PDF/plain text, keep the cover letter ready, and use the answer bank for repeated form questions.",
            "done": bool(optimization["optimized_resume_text"]),
        },
        {
            "title": "Human review before submit",
            "detail": "Open the target portal, paste only accurate answers, review every field, and submit manually when everything is correct.",
            "done": False,
        },
    ]


def _build_cover_letter(
    candidate_name: str,
    company_name: str,
    role_title: str,
    optimization: dict[str, Any],
    profile_notes: str,
) -> str:
    matched = ", ".join(title_case(keyword) for keyword in optimization["matched_keywords"][:5])
    gaps = ", ".join(title_case(keyword) for keyword in optimization["missing_keywords"][:3])
    gap_sentence = (
        f"Before submitting, I will make sure my application includes accurate examples for {gaps} where they reflect my real experience."
        if gaps
        else "The resume is already well aligned to the job description, so I will focus on concise examples and measurable outcomes."
    )
    profile_sentence = (
        f"Additional application context: {profile_notes.strip()}"
        if profile_notes.strip()
        else "I am happy to provide additional details about availability, work authorization, location preference, and compensation expectations during the process."
    )

    return "\n".join(
        [
            f"Dear {company_name} Hiring Team,",
            "",
            (
                f"I am excited to apply for the {role_title} role at {company_name}. "
                f"My background aligns with {matched or 'the responsibilities in the posting'}, "
                "and I can bring a practical, outcome-focused approach to the team."
            ),
            "",
            " ".join(optimization["strengths"][:2])
            or "I have relevant experience building solutions, collaborating across teams, and communicating clearly with stakeholders.",
            gap_sentence,
            "",
            profile_sentence,
            "",
            f"Sincerely,\n{candidate_name}",
        ]
    )


def _build_recruiter_message(candidate_name: str, company_name: str, role_title: str, optimization: dict[str, Any]) -> str:
    highlights = ", ".join(title_case(keyword) for keyword in optimization["matched_keywords"][:4]) or "the role requirements"
    return (
        f"Hi {company_name} team, I am applying for the {role_title} role and wanted to share my interest. "
        f"My resume is strongest around {highlights}, and I would welcome the chance to discuss how my experience maps to your needs. "
        f"Thank you, {candidate_name}."
    )


def _build_answer_bank(
    optimization: dict[str, Any],
    profile_notes: str,
    role_title: str,
    company_name: str,
) -> list[dict[str, str]]:
    matched = ", ".join(title_case(keyword) for keyword in optimization["matched_keywords"][:4]) or "the core responsibilities in the posting"
    strengths = " ".join(optimization["strengths"][:2]).lower()
    authorization_answer = (
        profile_notes
        if _profile_has_any(profile_notes, ["authorized", "sponsorship", "visa", "citizen", "permanent resident"])
        else "Add your accurate work authorization and sponsorship answer here before submitting."
    )
    logistics_answer = (
        profile_notes
        if _profile_has_any(profile_notes, ["available", "remote", "hybrid", "onsite", "salary", "compensation"])
        else "Add accurate availability, location preference, work mode, and compensation expectations before submitting."
    )

    return [
        {
            "question": "Why are you interested in this role?",
            "answer": (
                f"I am interested in the {role_title} role at {company_name} because it matches my experience with "
                f"{matched} and gives me a chance to contribute measurable outcomes."
            ),
        },
        {
            "question": "Why are you a strong fit?",
            "answer": (
                f"My fit comes from {strengths or 'relevant experience, practical execution, and clear communication'}. "
                f"I would support that with accurate examples from my resume and tailor them around {matched}."
            ),
        },
        {"question": "Work authorization / sponsorship", "answer": authorization_answer},
        {"question": "Availability / location / compensation", "answer": logistics_answer},
    ]


def _build_risk_flags(optimization: dict[str, Any], profile_notes: str, job_url: str) -> list[str]:
    flags: list[str] = []
    if optimization["ats_match_score"] < 65:
        flags.append("Resume match is below the recommended application threshold; tailor more evidence before applying.")
    if len(optimization["missing_keywords"]) > 10:
        flags.append("Many JD keywords are missing; add only truthful examples that reflect your real experience.")
    if not profile_notes.strip():
        flags.append("Profile details are empty; common portal questions still need accurate personal answers.")
    if not job_url.strip():
        flags.append("No job URL is saved; add the portal link so the application record is easy to revisit.")
    return flags or ["No major blockers found. Review all generated content for accuracy before submitting."]


def generate_application_packet(
    master_resume: str,
    job_description: str,
    company_name: str = "",
    job_url: str = "",
    profile_notes: str = "",
) -> dict[str, Any]:
    """Create a human-reviewed application packet without submitting to third-party job portals."""

    clean_resume = master_resume.strip()
    clean_job_description = job_description.strip()
    if not clean_resume or not clean_job_description:
        raise ValueError("Both master_resume and job_description are required.")

    optimization = optimize_resume(clean_resume, clean_job_description, include_pdf=False)
    role_title = get_role_title(clean_job_description)
    inferred_company = _infer_company_name(company_name, job_url, clean_job_description)
    candidate_name = get_candidate_name(clean_resume)
    profile_completeness = len([value for value in [company_name, job_url, profile_notes] if value.strip()]) / 3
    readiness_score = round(
        _clamp(optimization["ats_match_score"] * 0.72 + optimization["ats_readiness"] * 0.18 + profile_completeness * 10)
    )
    status = (
        "Ready for human-reviewed submission"
        if readiness_score >= 80
        else "Needs quick tailoring"
        if readiness_score >= 65
        else "Needs more application prep"
    )
    portal_steps = [
        (
            f"Open {job_url.strip()} and confirm it is the official application portal."
            if job_url.strip()
            else "Add the official job URL before starting the portal workflow."
        ),
        "Upload the tailored resume, then paste the cover letter only if the form requests one.",
        "Use the answer bank for repeated questions, editing every answer so it remains accurate and specific.",
        "Review consent, demographic, legal, salary, and sponsorship fields manually before submitting.",
        "After submission, save the confirmation number or email in your tracker.",
    ]

    return {
        "application_id": _application_id(inferred_company, role_title),
        "role_title": role_title,
        "company_name": inferred_company,
        "job_url": job_url.strip(),
        "readiness_score": readiness_score,
        "status": status,
        "fit_summary": f"{inferred_company} - {role_title}: {optimization['grade']} match with {optimization['keyword_coverage']}% keyword coverage.",
        "tailored_resume_text": optimization["optimized_resume_text"],
        "cover_letter": _build_cover_letter(candidate_name, inferred_company, role_title, optimization, profile_notes),
        "recruiter_message": _build_recruiter_message(candidate_name, inferred_company, role_title, optimization),
        "answer_bank": _build_answer_bank(optimization, profile_notes, role_title, inferred_company),
        "checklist": _build_checklist(optimization, profile_notes),
        "portal_steps": portal_steps,
        "risk_flags": _build_risk_flags(optimization, profile_notes, job_url),
        "automation_boundary": "This agent prepares tailored materials and a portal workflow. It does not auto-submit applications or misrepresent candidate information.",
        "resume_optimization": optimization,
    }
