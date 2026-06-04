from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl


class ScrapeRequest(BaseModel):
    search_terms: list[str] = Field(default_factory=lambda: ["data scientist"])
    resume_text: str | None = None
    generate_resumes: bool = False
    limit: int = Field(default=50, ge=1, le=200)


class ScoreRequest(BaseModel):
    resume_text: str = Field(min_length=50)


class ResumeRequest(BaseModel):
    resume_text: str = Field(min_length=50)


class ApplicantProfile(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    location: str | None = None
    resume_file_path: str | None = None
    cover_letter: str | None = None
    work_authorization: str | None = "Yes"


class ApplyRequest(BaseModel):
    profile: ApplicantProfile
    dry_run: bool = True


class JobRead(BaseModel):
    id: str
    source: str
    external_id: str
    title: str
    company: str
    location: str
    remote: bool
    url: HttpUrl | str
    portal: str
    posted_at: datetime
    scraped_at: datetime
    description: str
    match_score: float | None
    score_reason: str | None
    missing_keywords: list[str]
    generated_resume: str | None
    apply_status: str
    apply_notes: str | None
    applied_at: datetime | None

    model_config = {"from_attributes": True}


class ScrapeResponse(BaseModel):
    stored: int
    jobs: list[JobRead]


class ScoreResponse(BaseModel):
    match_score: float
    reason: str
    missing_keywords: list[str]


class ResumeResponse(BaseModel):
    generated_resume: str


class ApplyResponse(BaseModel):
    status: str
    portal: str
    notes: str
