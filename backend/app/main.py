from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .database import get_db, init_db
from .models import Job
from .schemas import (
    ApplyRequest,
    ApplyResponse,
    JobRead,
    ResumeRequest,
    ResumeResponse,
    ScoreRequest,
    ScoreResponse,
    ScrapeRequest,
    ScrapeResponse,
)
from .services.apply import PortalApplicant
from .services.pipeline import JobPipeline


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Remote Data Scientist Job Agent", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_pipeline(settings: Settings = Depends(get_settings)) -> JobPipeline:
    return JobPipeline(settings)


def get_job_or_404(job_id: str, db: Session) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/jobs/scrape", response_model=ScrapeResponse)
async def scrape_jobs(
    payload: ScrapeRequest,
    db: Session = Depends(get_db),
    pipeline: JobPipeline = Depends(get_pipeline),
) -> ScrapeResponse:
    jobs = await pipeline.scrape_and_store(
        db,
        search_terms=payload.search_terms,
        resume_text=payload.resume_text,
        generate_resumes=payload.generate_resumes,
        limit=payload.limit,
    )
    return ScrapeResponse(stored=len(jobs), jobs=[JobRead.model_validate(job) for job in jobs])


@app.get("/jobs", response_model=list[JobRead])
def list_jobs(db: Session = Depends(get_db)) -> list[JobRead]:
    jobs = db.scalars(JobPipeline.list_jobs_statement()).all()
    return [JobRead.model_validate(job) for job in jobs]


@app.get("/jobs/{job_id}", response_model=JobRead)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobRead:
    return JobRead.model_validate(get_job_or_404(job_id, db))


@app.post("/jobs/{job_id}/score", response_model=ScoreResponse)
async def score_job(
    job_id: str,
    payload: ScoreRequest,
    db: Session = Depends(get_db),
    pipeline: JobPipeline = Depends(get_pipeline),
) -> ScoreResponse:
    job = await pipeline.score_job(db, get_job_or_404(job_id, db), payload.resume_text)
    db.commit()
    return ScoreResponse(
        match_score=job.match_score or 0,
        reason=job.score_reason or "",
        missing_keywords=job.missing_keywords or [],
    )


@app.post("/jobs/{job_id}/resume", response_model=ResumeResponse)
async def generate_resume(
    job_id: str,
    payload: ResumeRequest,
    db: Session = Depends(get_db),
    pipeline: JobPipeline = Depends(get_pipeline),
) -> ResumeResponse:
    job = await pipeline.generate_resume(db, get_job_or_404(job_id, db), payload.resume_text)
    db.commit()
    return ResumeResponse(generated_resume=job.generated_resume or "")


@app.post("/jobs/{job_id}/apply", response_model=ApplyResponse)
async def apply_to_job(
    job_id: str,
    payload: ApplyRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ApplyResponse:
    job = get_job_or_404(job_id, db)
    result = await PortalApplicant(settings).apply(job.url, payload.profile, dry_run=payload.dry_run)
    job.apply_status = result.status
    job.apply_notes = result.notes
    job.applied_at = datetime.now(UTC) if result.status == "submitted" else None
    db.add(job)
    db.commit()
    return ApplyResponse(status=result.status, portal=result.portal, notes=result.notes)
