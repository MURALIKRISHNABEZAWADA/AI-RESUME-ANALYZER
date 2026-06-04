"""Deterministic ATS resume optimization logic."""

from __future__ import annotations

import base64
import re
from collections import Counter
from dataclasses import asdict, dataclass
from typing import Any

from service.pdf import render_pdf

STOP_WORDS = {
    "about",
    "above",
    "after",
    "again",
    "against",
    "also",
    "and",
    "any",
    "are",
    "because",
    "been",
    "being",
    "between",
    "both",
    "but",
    "can",
    "candidate",
    "company",
    "could",
    "day",
    "description",
    "did",
    "does",
    "doing",
    "down",
    "during",
    "each",
    "for",
    "from",
    "had",
    "has",
    "have",
    "having",
    "her",
    "here",
    "hers",
    "him",
    "himself",
    "his",
    "how",
    "into",
    "its",
    "job",
    "more",
    "most",
    "must",
    "our",
    "ours",
    "out",
    "own",
    "per",
    "position",
    "role",
    "same",
    "she",
    "should",
    "some",
    "such",
    "than",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "under",
    "until",
    "very",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "will",
    "with",
    "within",
    "work",
    "you",
    "your",
    "responsibilities",
    "requirements",
}

PRIORITY_TERMS = [
    "accessibility",
    "agile",
    "ai",
    "analytics",
    "api",
    "automation",
    "aws",
    "azure",
    "backend",
    "business intelligence",
    "ci cd",
    "cloud",
    "collaboration",
    "communication",
    "css",
    "data analysis",
    "data engineering",
    "data visualization",
    "database",
    "devops",
    "docker",
    "etl",
    "express",
    "figma",
    "frontend",
    "git",
    "graphql",
    "html",
    "java",
    "javascript",
    "kubernetes",
    "leadership",
    "machine learning",
    "microservices",
    "mongodb",
    "nextjs",
    "node",
    "nodejs",
    "postgresql",
    "problem solving",
    "product management",
    "python",
    "react",
    "redux",
    "rest",
    "salesforce",
    "scrum",
    "security",
    "sql",
    "stakeholder management",
    "tailwind",
    "testing",
    "typescript",
    "user experience",
    "ux",
    "vite",
    "vue",
]

ACTION_VERBS = [
    "achieved",
    "analyzed",
    "architected",
    "automated",
    "built",
    "collaborated",
    "created",
    "delivered",
    "designed",
    "developed",
    "drove",
    "enhanced",
    "implemented",
    "improved",
    "increased",
    "launched",
    "led",
    "managed",
    "migrated",
    "optimized",
    "owned",
    "reduced",
    "shipped",
    "streamlined",
    "tested",
]


@dataclass(frozen=True)
class AtsIssue:
    title: str
    detail: str
    severity: str


@dataclass(frozen=True)
class ResumeSections:
    summary: bool
    experience: bool
    skills: bool
    education: bool
    projects: bool
    certifications: bool


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#.\s-]", " ", value.lower().replace("&", " and "))).strip()


def tokenize(value: str) -> list[str]:
    return [word for word in normalize(value).split(" ") if len(word) > 2 and word not in STOP_WORDS]


def title_case(value: str) -> str:
    replacements = {
        "Ai": "AI",
        "Api": "API",
        "Css": "CSS",
        "Html": "HTML",
        "Sql": "SQL",
        "Ux": "UX",
        "Ci": "CI",
        "Cd": "CD",
    }
    titled = " ".join(word.upper() if len(word) <= 3 else f"{word[0].upper()}{word[1:]}" for word in value.split(" "))
    for original, replacement in replacements.items():
        titled = re.sub(rf"\b{original}\b", replacement, titled)
    return titled


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return min(max(value, minimum), maximum)


def unique(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def contains_term(text: str, term: str) -> bool:
    haystack = f" {normalize(text)} "
    needle = normalize(term)
    if not needle:
        return False
    return f" {needle} " in haystack or f" {needle.removesuffix('s')} " in haystack


def word_count(text: str) -> int:
    return len(tokenize(text))


def extract_years(text: str) -> int:
    matches = [int(match) for match in re.findall(r"(\d+)\+?\s*(?:years|yrs)", text, re.IGNORECASE)]
    return max(matches) if matches else 0


def extract_sections(resume: str) -> ResumeSections:
    def has_heading(pattern: str) -> bool:
        return bool(re.search(rf"(^|\n)\s*({pattern})\s*:?\s*(\n|$)", resume, re.IGNORECASE))

    return ResumeSections(
        summary=has_heading(r"professional\s+summary|summary|profile|objective"),
        experience=has_heading(r"work\s+experience|professional\s+experience|experience|employment"),
        skills=has_heading(r"technical\s+skills|core\s+skills|skills|competencies"),
        education=has_heading(r"education|academic\s+background"),
        projects=has_heading(r"projects|selected\s+projects"),
        certifications=has_heading(r"certifications|licenses|credentials"),
    )


def get_contact_signals(resume: str) -> dict[str, bool]:
    return {
        "email": bool(re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", resume, re.IGNORECASE)),
        "phone": bool(re.search(r"(\+?\d[\d\s().-]{7,}\d)", resume)),
        "linkedin": bool(re.search(r"linkedin\.com/", resume, re.IGNORECASE)),
        "portfolio": bool(re.search(r"(github\.com/|portfolio|personal\s+site|https?://)", resume, re.IGNORECASE)),
    }


def extract_ats_keywords(job_description: str, limit: int = 32) -> list[str]:
    normalized_job = normalize(job_description)
    phrase_matches = [term for term in PRIORITY_TERMS if contains_term(normalized_job, term)]
    frequencies = Counter(word.removesuffix("s") for word in tokenize(job_description) if len(word) > 2)
    frequent_terms = [
        term
        for term, _count in sorted(frequencies.items(), key=lambda item: (-item[1], item[0]))
        if not any(term in phrase for phrase in phrase_matches)
    ]
    return unique([*phrase_matches, *frequent_terms])[:limit]


def get_ats_issues(resume: str, sections: ResumeSections) -> list[AtsIssue]:
    issues: list[AtsIssue] = []
    contacts = get_contact_signals(resume)
    words = word_count(resume)
    long_lines = len([line for line in resume.splitlines() if len(line.strip()) > 180])
    non_ascii_count = len([character for character in resume if ord(character) > 127])

    if words < 220:
        issues.append(
            AtsIssue(
                "Resume is too short",
                "Add more role-specific accomplishments, skills, and measurable impact so the resume has enough context for ATS ranking.",
                "major",
            )
        )
    if not contacts["email"] or not contacts["phone"]:
        issues.append(
            AtsIssue(
                "Missing key contact details",
                "Include a professional email address and phone number near the top of the resume.",
                "major",
            )
        )
    if not sections.summary:
        issues.append(
            AtsIssue(
                "Missing summary section",
                "Add a short Professional Summary that mirrors the target role and strongest qualifications.",
                "moderate",
            )
        )
    if not sections.skills:
        issues.append(
            AtsIssue(
                "Missing skills section",
                "Create a Core Skills or Technical Skills section with job-relevant keywords.",
                "moderate",
            )
        )
    if not sections.experience:
        issues.append(
            AtsIssue(
                "Missing experience section",
                "Use a standard Experience heading so ATS parsers can identify work history.",
                "major",
            )
        )
    if not sections.education:
        issues.append(AtsIssue("Missing education section", "Add an Education heading, even if it is concise.", "minor"))
    if re.search(r"(\|.*\|)|\t", resume):
        issues.append(
            AtsIssue(
                "Possible table formatting",
                "Avoid tables, columns, and tab-separated layouts. ATS systems parse single-column text more reliably.",
                "moderate",
            )
        )
    if non_ascii_count > 8:
        issues.append(
            AtsIssue(
                "Special characters detected",
                "Replace decorative bullets, icons, and symbols with plain text characters for safer ATS parsing.",
                "minor",
            )
        )
    if long_lines > 2:
        issues.append(
            AtsIssue(
                "Dense paragraphs detected",
                "Break long paragraphs into concise bullets to improve scanability for recruiters and parsers.",
                "minor",
            )
        )
    if re.search(r"\b(i|me|my|mine)\b", resume, re.IGNORECASE):
        issues.append(
            AtsIssue(
                "First-person language detected",
                "Resume bullets usually read stronger without first-person pronouns.",
                "minor",
            )
        )

    return issues


def score_ats_readiness(issues: list[AtsIssue]) -> int:
    penalties = {"major": 16, "moderate": 10, "minor": 5}
    return round(clamp(100 - sum(penalties[issue.severity] for issue in issues)))


def score_impact(resume: str) -> int:
    metrics = len(re.findall(r"(\d+%|\$\d+|\d+x|\d+\+|\b\d{2,}\b)", resume, re.IGNORECASE))
    verb_matches = len([verb for verb in ACTION_VERBS if contains_term(resume, verb)])
    return round(clamp(metrics * 4 + verb_matches * 3, 0, 10))


def get_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "Needs work"


def get_role_title(job_description: str) -> str:
    title_match = re.search(r"(?:job\s*title|role|position)\s*:?\s*([^\n.]+)", job_description, re.IGNORECASE)
    if title_match:
        return title_match.group(1).strip()[:80]
    for line in (line.strip() for line in job_description.splitlines()):
        if 8 < len(line) < 80 and not re.search(r"[.!?]$", line):
            return line
    return "Target Role"


def get_candidate_name(resume: str) -> str:
    for line in [line.strip() for line in resume.splitlines() if line.strip()][:6]:
        if (
            len(line) <= 60
            and not re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", line, re.IGNORECASE)
            and not re.search(r"(\+?\d[\d\s().-]{7,}\d)", line)
            and not re.search(r"linkedin|github|portfolio|http", line, re.IGNORECASE)
        ):
            return line
    return "Your Name"


def get_contact_line(resume: str) -> str:
    lines = [
        line.strip()
        for line in resume.splitlines()
        if re.search(r"@|\+?\d[\d\s().-]{7,}\d|linkedin|github|http", line, re.IGNORECASE)
    ][:3]
    return " | ".join(lines) if lines else "Email | Phone | LinkedIn | Portfolio"


def extract_existing_bullets(resume: str, limit: int = 10) -> list[str]:
    bullets: list[str] = []
    for line in resume.splitlines():
        cleaned = re.sub(r"^[\s*\-\u2022]+", "", line).strip()
        if 35 <= len(cleaned) <= 240 and (
            line.lstrip().startswith(("-", "*", "\u2022")) or any(contains_term(cleaned, verb) for verb in ACTION_VERBS) or re.search(r"\d", cleaned)
        ):
            bullets.append(cleaned)
    return bullets[:limit]


def rewrite_bullet(bullet: str, keywords: list[str], index: int) -> dict[str, str]:
    cleaned = re.sub(r"\b(I|me|my|mine)\b\s*", "", bullet.strip(), flags=re.IGNORECASE)
    cleaned = cleaned[0].lower() + cleaned[1:] if cleaned else "add a verified accomplishment"
    starts_with_action = any(contains_term(cleaned.split(" ", 1)[0], verb) for verb in ACTION_VERBS)
    rewritten = cleaned if starts_with_action else f"Delivered {cleaned}"

    keyword = next((term for term in keywords[index:] + keywords[:index] if not contains_term(rewritten, term)), "")
    if keyword:
        rewritten = f"{rewritten.rstrip('.')} with emphasis on {title_case(keyword)}."
    elif not rewritten.endswith("."):
        rewritten = f"{rewritten}."

    note = "Preserves the original accomplishment while adding job-description language."
    if not re.search(r"(\d+%|\$\d+|\d+x|\d+\+|\b\d{2,}\b)", rewritten, re.IGNORECASE):
        note = "Add a verified metric for scope, speed, savings, quality, or revenue impact."

    return {"original": bullet, "rewritten": rewritten, "note": note}


def build_skill_line(matched_keywords: list[str], missing_keywords: list[str]) -> str:
    skills = unique([*matched_keywords, *missing_keywords[:10]])[:16]
    return " | ".join(title_case(skill) for skill in skills) if skills else "Add skills from the target job description"


def build_resume_text(
    resume: str,
    job_description: str,
    matched_keywords: list[str],
    missing_keywords: list[str],
    rewritten_bullets: list[dict[str, str]],
) -> str:
    role_title = get_role_title(job_description)
    role_keywords = [title_case(keyword) for keyword in unique([*matched_keywords, *missing_keywords])[:8]]
    suggested_keywords = [title_case(keyword) for keyword in missing_keywords[:6]]
    bullets = rewritten_bullets or [
        {
            "rewritten": "Add a truthful accomplishment that explains the most relevant project, responsibility, or outcome for this role."
        },
        {"rewritten": "Add a quantified accomplishment using verified scope, savings, speed, quality, or revenue impact."},
        {"rewritten": "Add a collaboration bullet that names stakeholders, teams, customers, or cross-functional partners."},
    ]
    targeted_bullets = (
        [f"- Add a truthful accomplishment that demonstrates {keyword} in the context of the target role." for keyword in suggested_keywords]
        or ["- Add one more measurable accomplishment that directly matches the job description."]
    )

    return "\n".join(
        [
            get_candidate_name(resume),
            get_contact_line(resume),
            "",
            "PROFESSIONAL SUMMARY",
            (
                f"{role_title}-focused professional with experience aligned to "
                f"{', '.join(role_keywords[:5]) or 'the target role'}. Brings a record of delivering practical outcomes, "
                "collaborating across teams, and communicating work clearly."
            ),
            "",
            "CORE SKILLS",
            build_skill_line(matched_keywords, missing_keywords),
            "",
            "PROFESSIONAL EXPERIENCE",
            "Current or Most Relevant Role | Company | Dates",
            *[f"- {item['rewritten']}" for item in bullets],
            *targeted_bullets,
            "",
            "PROJECTS OR SELECTED ACHIEVEMENTS",
            f"- Add a role-relevant project that uses {', '.join(role_keywords[:3]) or 'the most important job keywords'}.",
            "- Add measurable impact and tools used so recruiters can quickly connect your work to the job description.",
            "",
            "EDUCATION",
            "Degree or Certification | Institution | Year",
            "",
            "ATS FORMATTING NOTES",
            "- Keep this resume in a single-column layout with standard headings.",
            "- Use plain text bullets and avoid tables, images, icons, headers, footers, and text boxes.",
            "- Replace every placeholder with accurate details from your real experience before applying.",
        ]
    )


def get_strengths(matched_keywords: list[str], sections: ResumeSections, ats_issues: list[AtsIssue], resume: str) -> list[str]:
    strengths: list[str] = []
    if len(matched_keywords) >= 8:
        strengths.append("Strong keyword alignment with the job description.")
    if sections.experience and sections.skills:
        strengths.append("Experience and skills are organized under ATS-recognizable headings.")
    if score_impact(resume) >= 7:
        strengths.append("Resume includes measurable impact and action-oriented language.")
    if len(ats_issues) <= 2:
        strengths.append("Formatting appears relatively ATS-safe.")
    return strengths or ["The analyzer found a starting point, but the resume needs more targeted evidence."]


def get_improvements(missing_keywords: list[str], ats_issues: list[AtsIssue], resume: str) -> list[str]:
    improvements: list[str] = []
    if missing_keywords:
        improvements.append(
            f"Add truthful examples for missing JD keywords: {', '.join(title_case(keyword) for keyword in missing_keywords[:5])}."
        )
    improvements.extend(issue.detail for issue in ats_issues[:3])
    if score_impact(resume) < 7:
        improvements.append("Rewrite bullets with action verbs and verified metrics such as percentages, cost savings, revenue, speed, scale, or quality improvements.")
    return unique(improvements)[:6]


def optimize_resume(master_resume: str, job_description: str, include_pdf: bool = True, keyword_limit: int = 32) -> dict[str, Any]:
    clean_resume = master_resume.strip()
    clean_job_description = job_description.strip()
    if not clean_resume or not clean_job_description:
        raise ValueError("Both master_resume and job_description are required.")

    sections = extract_sections(clean_resume)
    ats_keywords = extract_ats_keywords(clean_job_description, keyword_limit)
    matched_keywords = [keyword for keyword in ats_keywords if contains_term(clean_resume, keyword)]
    missing_keywords = [keyword for keyword in ats_keywords if not contains_term(clean_resume, keyword)]
    keyword_coverage = round((len(matched_keywords) / len(ats_keywords)) * 100) if ats_keywords else 0
    ats_issues = get_ats_issues(clean_resume, sections)
    ats_readiness = score_ats_readiness(ats_issues)
    structure_score = sum([sections.summary, sections.experience, sections.skills, sections.education]) * 2.5
    impact_score = score_impact(clean_resume)
    required_years = extract_years(clean_job_description)
    resume_years = extract_years(clean_resume)
    experience_score = clamp((resume_years / required_years) * 15, 4, 15) if required_years else 12
    score = round(clamp(keyword_coverage * 0.45 + ats_readiness * 0.2 + structure_score + impact_score + experience_score))
    rewritten_bullets = [
        rewrite_bullet(bullet, unique([*matched_keywords, *missing_keywords]), index)
        for index, bullet in enumerate(extract_existing_bullets(clean_resume))
    ]
    optimized_resume_text = build_resume_text(
        clean_resume,
        clean_job_description,
        matched_keywords,
        missing_keywords,
        rewritten_bullets,
    )
    pdf_bytes = render_pdf(optimized_resume_text) if include_pdf else b""

    return {
        "ats_match_score": score,
        "grade": get_grade(score),
        "keyword_coverage": keyword_coverage,
        "ats_readiness": ats_readiness,
        "ats_keywords": [{"term": keyword, "matched": keyword in matched_keywords} for keyword in ats_keywords],
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "ats_issues": [asdict(issue) for issue in ats_issues],
        "strengths": get_strengths(matched_keywords, sections, ats_issues, clean_resume),
        "improvements": get_improvements(missing_keywords, ats_issues, clean_resume),
        "sections": asdict(sections),
        "rewritten_bullets": rewritten_bullets,
        "optimized_resume_text": optimized_resume_text,
        "pdf_filename": "ats-optimized-resume.pdf",
        "pdf_mime_type": "application/pdf",
        "pdf_base64": base64.b64encode(pdf_bytes).decode("ascii") if include_pdf else "",
    }

