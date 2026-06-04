from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.database import make_engine
from app.models import Base
from app.services.openai_client import MatchResult
from app.services.pipeline import JobPipeline
from app.services.scraper import ScrapedJob


class FakeScraper:
    async def scrape(self, _search_terms, _window_hours, _limit):
        return [
            ScrapedJob(
                source="fixture",
                external_id="job-1",
                title="Remote Data Scientist",
                company="Acme Analytics",
                location="Remote",
                remote=True,
                url="https://jobs.lever.co/acme/job-1",
                portal="lever",
                posted_at=datetime(2026, 6, 4, 12, tzinfo=UTC),
                description="Build Python and SQL models for forecasting.",
            )
        ]


class FakeAi:
    async def score_resume(self, _resume_text, _job_description):
        return MatchResult(match_score=88, reason="Strong Python and SQL alignment.", missing_keywords=["forecasting"])

    async def generate_resume(self, _resume_text, _job_description):
        return "ATS RESUME\nPython | SQL | Forecasting"


@pytest.mark.asyncio
async def test_pipeline_upserts_scores_and_generates_resume():
    engine = make_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    pipeline = JobPipeline(Settings(database_url="sqlite+pysqlite:///:memory:"), scraper=FakeScraper(), ai=FakeAi())

    jobs = await pipeline.scrape_and_store(
        db,
        search_terms=["data scientist"],
        resume_text="Data Scientist with Python SQL modeling experience and forecasting projects.",
        generate_resumes=True,
        limit=10,
    )

    assert len(jobs) == 1
    assert jobs[0].match_score == 88
    assert jobs[0].missing_keywords == ["forecasting"]
    assert jobs[0].generated_resume.startswith("ATS RESUME")

    repeated_jobs = await pipeline.scrape_and_store(db, ["data scientist"], None, False, 10)

    assert len(repeated_jobs) == 1
    assert db.query(type(jobs[0])).count() == 1
