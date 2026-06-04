# Remote Data Scientist Job Agent

Full-stack application for discovering fresh remote Data Scientist roles, storing them in PostgreSQL, scoring resume fit with OpenAI, generating ATS optimized resumes, and preparing applications for Greenhouse, Lever, and Workday portals.

## Features

- Scrapes remote job feeds for Data Scientist and related roles.
- Filters postings to jobs published within the last 72 hours.
- Extracts and normalizes job descriptions from HTML.
- Stores jobs, scores, generated resumes, and application status in PostgreSQL.
- Uses OpenAI for resume-to-job match scoring and ATS resume generation when `OPENAI_API_KEY` is configured.
- Provides deterministic local scoring and resume generation fallback for development.
- Uses Playwright portal adapters for Greenhouse, Lever, and Workday with dry-run behavior by default.
- Exposes a React dashboard for scraping, scoring, resume tailoring, and application dry runs.

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Create a PostgreSQL database and set:

```bash
export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/job_agent"
export OPENAI_API_KEY="sk-..."
```

Run the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Useful optional settings:

- `OPENAI_MODEL`: defaults to `gpt-4.1-mini`.
- `SCRAPE_WINDOW_HOURS`: defaults to `72`.
- `PLAYWRIGHT_HEADLESS`: defaults to `true`.
- `AUTO_SUBMIT_APPLICATIONS`: defaults to `false`; keep false unless you intentionally want Playwright to submit forms.

## Frontend setup

```bash
npm install
npm run dev
```

The dashboard calls `http://localhost:8000` by default. Override with:

```bash
export VITE_API_BASE_URL="http://localhost:8000"
```

## API overview

- `POST /jobs/scrape`: scrape fresh remote jobs, store them, and optionally score/generate resumes.
- `GET /jobs`: list stored jobs.
- `POST /jobs/{job_id}/score`: score one job against resume text.
- `POST /jobs/{job_id}/resume`: generate an ATS optimized resume for one job.
- `POST /jobs/{job_id}/apply`: run a Greenhouse, Lever, or Workday application automation dry run by default.

## Tests

```bash
cd backend
pytest
```

```bash
npm run build
```
