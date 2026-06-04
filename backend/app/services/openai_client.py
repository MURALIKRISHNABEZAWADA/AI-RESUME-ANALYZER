from __future__ import annotations

import json
import re
from dataclasses import dataclass

from openai import AsyncOpenAI

from ..config import Settings


@dataclass(frozen=True)
class MatchResult:
    match_score: float
    reason: str
    missing_keywords: list[str]


class ResumeAiService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    async def score_resume(self, resume_text: str, job_description: str) -> MatchResult:
        if not self.client:
            return self._heuristic_score(resume_text, job_description)

        response = await self.client.responses.create(
            model=self.settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You score resume fit for a job. Return strict JSON with keys "
                        "match_score (0-100 number), reason (short string), missing_keywords (array of strings)."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Resume:\n{resume_text}\n\nJob description:\n{job_description}",
                },
            ],
        )
        payload = self._parse_json(response.output_text)
        return MatchResult(
            match_score=float(payload.get("match_score", 0)),
            reason=str(payload.get("reason", "OpenAI returned a match score.")),
            missing_keywords=[str(item) for item in payload.get("missing_keywords", [])][:20],
        )

    async def generate_resume(self, resume_text: str, job_description: str) -> str:
        if not self.client:
            return self._heuristic_resume(resume_text, job_description)

        response = await self.client.responses.create(
            model=self.settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "Rewrite resumes for ATS. Preserve only truthful candidate facts, use a single-column text "
                        "format, standard headings, quantified bullets where supported, and keywords from the job."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Original resume:\n{resume_text}\n\nTarget job:\n{job_description}",
                },
            ],
        )
        return response.output_text.strip()

    @staticmethod
    def _parse_json(value: str) -> dict:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", value, flags=re.DOTALL)
            return json.loads(match.group(0)) if match else {}

    @staticmethod
    def _keywords(value: str) -> list[str]:
        words = re.findall(r"[a-zA-Z][a-zA-Z+#.-]{2,}", value.lower())
        stop = {
            "and",
            "for",
            "the",
            "with",
            "you",
            "are",
            "our",
            "job",
            "role",
            "data",
            "scientist",
            "remote",
            "work",
            "will",
        }
        counts: dict[str, int] = {}
        for word in words:
            if word not in stop:
                counts[word] = counts.get(word, 0) + 1
        return [word for word, _count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:25]]

    def _heuristic_score(self, resume_text: str, job_description: str) -> MatchResult:
        resume_words = set(self._keywords(resume_text))
        job_keywords = self._keywords(job_description)
        if not job_keywords:
            return MatchResult(0, "No job keywords were available to score.", [])
        matched = [word for word in job_keywords if word in resume_words]
        missing = [word for word in job_keywords if word not in resume_words][:12]
        score = round((len(matched) / len(job_keywords)) * 100, 1)
        return MatchResult(
            match_score=score,
            reason="Heuristic local score based on overlapping job keywords because OPENAI_API_KEY is not configured.",
            missing_keywords=missing,
        )

    def _heuristic_resume(self, resume_text: str, job_description: str) -> str:
        missing = self._heuristic_score(resume_text, job_description).missing_keywords[:8]
        source_lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
        header = "\n".join(source_lines[:4]) if source_lines else "Candidate Name\nEmail | Phone | LinkedIn"
        keyword_line = ", ".join(keyword.title() for keyword in missing) or "target role keywords"
        return (
            f"{header}\n\n"
            "PROFESSIONAL SUMMARY\n"
            "Data science professional aligned to the target role. Highlight verified experience with analytics, "
            "machine learning, experimentation, stakeholder communication, and measurable business impact.\n\n"
            "CORE SKILLS\n"
            f"Python | SQL | Machine Learning | Statistics | Data Visualization | {keyword_line}\n\n"
            "PROFESSIONAL EXPERIENCE\n"
            "- Rewrite each existing accomplishment with an action verb, business context, tools used, and a measurable result.\n"
            "- Add truthful evidence for the target role keywords listed in Core Skills.\n"
            "- Keep bullets concise, single-column, and free of tables, icons, text boxes, or decorative formatting.\n\n"
            "EDUCATION\n"
            "Add degree, institution, and graduation year or relevant certifications."
        )
