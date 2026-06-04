from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.services.scraper import JobScraper, ScrapedJob, detect_portal, html_to_text, parse_posted_at


def test_description_extraction_and_portal_detection():
    html = "<h1>Role</h1><script>ignore()</script><p>Build ML models.</p>"

    assert html_to_text(html) == "Role\nBuild ML models."
    assert detect_portal("https://boards.greenhouse.io/acme/jobs/123") == "greenhouse"
    assert detect_portal("https://jobs.lever.co/acme/123") == "lever"
    assert detect_portal("https://acme.wd1.myworkdayjobs.com/job/123") == "workday"


def test_parse_posted_at_normalizes_to_utc():
    parsed = parse_posted_at("2026-06-04T12:15:00Z")

    assert parsed == datetime(2026, 6, 4, 12, 15, tzinfo=UTC)


@pytest.mark.asyncio
async def test_scrape_filters_to_data_scientist_jobs_within_72_hours():
    now = datetime.now(UTC)
    jobs = [
        ScrapedJob(
            source="test",
            external_id="fresh",
            title="Remote Data Scientist",
            company="Acme",
            location="Remote",
            remote=True,
            url="https://boards.greenhouse.io/acme/jobs/fresh",
            portal="greenhouse",
            posted_at=now - timedelta(hours=4),
            description="Python SQL machine learning experimentation",
        ),
        ScrapedJob(
            source="test",
            external_id="old",
            title="Remote Data Scientist",
            company="OldCo",
            location="Remote",
            remote=True,
            url="https://jobs.lever.co/old/1",
            portal="lever",
            posted_at=now - timedelta(hours=80),
            description="Python SQL",
        ),
        ScrapedJob(
            source="test",
            external_id="wrong-title",
            title="Backend Engineer",
            company="OtherCo",
            location="Remote",
            remote=True,
            url="https://example.com/backend",
            portal="other",
            posted_at=now - timedelta(hours=1),
            description="Python services",
        ),
    ]

    class StubScraper(JobScraper):
        async def _fetch_remoteok(self, _client, _term):
            return jobs

        async def _fetch_remotive(self, _client, _term):
            return []

        async def _fetch_jobicy(self, _client, _term):
            return []

    fresh = await StubScraper().scrape(["data scientist"], window_hours=72, limit=20)

    assert [job.external_id for job in fresh] == ["fresh"]


@pytest.mark.asyncio
async def test_scrape_continues_when_one_source_fails():
    now = datetime.now(UTC)

    class StubScraper(JobScraper):
        async def _fetch_remoteok(self, _client, _term):
            raise httpx.HTTPStatusError(
                "blocked",
                request=httpx.Request("GET", "https://remoteok.com/api"),
                response=httpx.Response(403),
            )

        async def _fetch_remotive(self, _client, _term):
            return [
                ScrapedJob(
                    source="remotive",
                    external_id="fresh",
                    title="Data Scientist",
                    company="Acme",
                    location="Remote",
                    remote=True,
                    url="https://jobs.lever.co/acme/fresh",
                    portal="lever",
                    posted_at=now,
                    description="Python SQL machine learning",
                )
            ]

        async def _fetch_jobicy(self, _client, _term):
            return []

    jobs = await StubScraper().scrape(["data scientist"], window_hours=72, limit=5)

    assert [job.source for job in jobs] == ["remotive"]
