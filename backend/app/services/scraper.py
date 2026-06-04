from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from html import unescape
from urllib.parse import urlencode

import httpx
from bs4 import BeautifulSoup


REMOTEOK_URL = "https://remoteok.com/api"
REMOTIVE_URL = "https://remotive.com/api/remote-jobs"


@dataclass(frozen=True)
class ScrapedJob:
    source: str
    external_id: str
    title: str
    company: str
    location: str
    remote: bool
    url: str
    portal: str
    posted_at: datetime
    description: str


def parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None

    cleaned = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(cleaned)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(cleaned)
        except (TypeError, ValueError):
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def html_to_text(value: str | None) -> str:
    if not value:
        return ""

    soup = BeautifulSoup(value, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n")
    text = unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def detect_portal(url: str) -> str:
    lowered = url.lower()
    if "greenhouse.io" in lowered or "greenhouse.com" in lowered:
        return "greenhouse"
    if "lever.co" in lowered:
        return "lever"
    if "myworkdayjobs.com" in lowered or "workdayjobs.com" in lowered:
        return "workday"
    return "other"


def is_data_science_role(title: str, search_terms: list[str]) -> bool:
    normalized = title.lower()
    if any(term.lower() in normalized for term in search_terms):
        return True
    return any(term in normalized for term in ("data scientist", "machine learning", "ml engineer", "data science"))


class JobScraper:
    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client

    async def scrape(self, search_terms: list[str], window_hours: int, limit: int = 50) -> list[ScrapedJob]:
        cutoff = datetime.now(UTC) - timedelta(hours=window_hours)
        async with self._get_client() as client:
            jobs = []
            for term in search_terms:
                jobs.extend(await self._fetch_remoteok(client, term))
                jobs.extend(await self._fetch_remotive(client, term))

        fresh_jobs = [
            job
            for job in jobs
            if job.posted_at >= cutoff and is_data_science_role(job.title, search_terms) and job.description
        ]
        return self._dedupe(fresh_jobs)[:limit]

    def _get_client(self):
        if self._client:
            return _BorrowedClient(self._client)
        headers = {"User-Agent": "remote-data-scientist-job-agent/1.0"}
        return httpx.AsyncClient(timeout=30, follow_redirects=True, headers=headers)

    async def _fetch_remoteok(self, client: httpx.AsyncClient, term: str) -> list[ScrapedJob]:
        params = urlencode({"tags": term})
        response = await client.get(f"{REMOTEOK_URL}?{params}")
        response.raise_for_status()
        payload = response.json()
        jobs: list[ScrapedJob] = []
        for item in payload if isinstance(payload, list) else []:
            if not isinstance(item, dict) or not item.get("id"):
                continue
            posted_at = parse_posted_at(item.get("date") or item.get("epoch"))
            if not posted_at:
                continue
            url = item.get("apply_url") or item.get("url") or ""
            description = html_to_text(item.get("description"))
            jobs.append(
                ScrapedJob(
                    source="remoteok",
                    external_id=str(item["id"]),
                    title=str(item.get("position") or ""),
                    company=str(item.get("company") or ""),
                    location=str(item.get("location") or "Remote"),
                    remote=True,
                    url=str(url),
                    portal=detect_portal(str(url)),
                    posted_at=posted_at,
                    description=description,
                )
            )
        return jobs

    async def _fetch_remotive(self, client: httpx.AsyncClient, term: str) -> list[ScrapedJob]:
        params = urlencode({"search": term})
        response = await client.get(f"{REMOTIVE_URL}?{params}")
        response.raise_for_status()
        payload = response.json()
        jobs: list[ScrapedJob] = []
        for item in payload.get("jobs", []) if isinstance(payload, dict) else []:
            posted_at = parse_posted_at(item.get("publication_date"))
            if not posted_at:
                continue
            url = str(item.get("url") or "")
            jobs.append(
                ScrapedJob(
                    source="remotive",
                    external_id=str(item.get("id") or url),
                    title=str(item.get("title") or ""),
                    company=str(item.get("company_name") or ""),
                    location=str(item.get("candidate_required_location") or "Remote"),
                    remote=True,
                    url=url,
                    portal=detect_portal(url),
                    posted_at=posted_at,
                    description=html_to_text(item.get("description")),
                )
            )
        return jobs

    @staticmethod
    def _dedupe(jobs: list[ScrapedJob]) -> list[ScrapedJob]:
        seen: set[str] = set()
        unique_jobs: list[ScrapedJob] = []
        for job in sorted(jobs, key=lambda item: item.posted_at, reverse=True):
            key = job.url or f"{job.source}:{job.external_id}"
            if key in seen:
                continue
            seen.add(key)
            unique_jobs.append(job)
        return unique_jobs


class _BorrowedClient:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def __aenter__(self):
        return self.client

    async def __aexit__(self, *_args):
        return None
