from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Job
from .openai_client import ResumeAiService
from .scraper import JobScraper, ScrapedJob


class JobPipeline:
    def __init__(self, settings: Settings, scraper: JobScraper | None = None, ai: ResumeAiService | None = None):
        self.settings = settings
        self.scraper = scraper or JobScraper()
        self.ai = ai or ResumeAiService(settings)

    async def scrape_and_store(
        self,
        db: Session,
        search_terms: list[str],
        resume_text: str | None,
        generate_resumes: bool,
        limit: int,
    ) -> list[Job]:
        scraped_jobs = await self.scraper.scrape(search_terms, self.settings.scrape_window_hours, limit)
        stored_jobs = [self._upsert_job(db, item) for item in scraped_jobs]
        db.commit()

        if resume_text:
            for job in stored_jobs:
                await self.score_job(db, job, resume_text)
                if generate_resumes:
                    await self.generate_resume(db, job, resume_text)
            db.commit()

        return stored_jobs

    async def score_job(self, db: Session, job: Job, resume_text: str) -> Job:
        result = await self.ai.score_resume(resume_text, job.description)
        job.match_score = result.match_score
        job.score_reason = result.reason
        job.missing_keywords = result.missing_keywords
        db.add(job)
        db.flush()
        db.refresh(job)
        return job

    async def generate_resume(self, db: Session, job: Job, resume_text: str) -> Job:
        job.generated_resume = await self.ai.generate_resume(resume_text, job.description)
        db.add(job)
        db.flush()
        db.refresh(job)
        return job

    @staticmethod
    def list_jobs_statement() -> Select[tuple[Job]]:
        return select(Job).order_by(Job.posted_at.desc(), Job.scraped_at.desc())

    @staticmethod
    def _upsert_job(db: Session, scraped: ScrapedJob) -> Job:
        existing = db.scalar(select(Job).where(Job.source == scraped.source, Job.external_id == scraped.external_id))
        if existing:
            existing.title = scraped.title
            existing.company = scraped.company
            existing.location = scraped.location
            existing.remote = scraped.remote
            existing.url = scraped.url
            existing.portal = scraped.portal
            existing.posted_at = scraped.posted_at
            existing.description = scraped.description
            db.add(existing)
            return existing

        job = Job(
            source=scraped.source,
            external_id=scraped.external_id,
            title=scraped.title,
            company=scraped.company,
            location=scraped.location,
            remote=scraped.remote,
            url=scraped.url,
            portal=scraped.portal,
            posted_at=scraped.posted_at,
            description=scraped.description,
        )
        db.add(job)
        return job
