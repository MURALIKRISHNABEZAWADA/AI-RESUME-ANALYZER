# Remote Data Scientist Job Agent

Full-stack application for discovering fresh remote Data Scientist roles, storing them in PostgreSQL, scoring resume fit, generating ATS optimized resumes, and preparing applications for Greenhouse, Lever, and Workday portals.

## Features

- Scrapes remote job feeds for Data Scientist and related roles.
- Filters postings to jobs published within the last 72 hours.
- Extracts and normalizes job descriptions from HTML.
- Stores jobs, scores, generated resumes, and application status in PostgreSQL.
- Uses OpenAI for resume-to-job match scoring and ATS resume generation when `OPENAI_API_KEY` is configured.
- Provides deterministic local scoring and resume generation fallback for development.
- Uses Playwright portal adapters for Greenhouse, Lever, and Workday with dry-run behavior by default.
- Exposes a React dashboard for scraping, scoring, resume tailoring, and application dry runs.
- Includes a standard-library Python ATS service that extracts keywords, rewrites bullets, calculates a match score, and returns an ATS-optimized PDF.

## FastAPI job agent backend

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

### Job agent API

- `POST /jobs/scrape`: scrape fresh remote jobs, store them, and optionally score/generate resumes.
- `GET /jobs`: list stored jobs.
- `POST /jobs/{job_id}/score`: score one job against resume text.
- `POST /jobs/{job_id}/resume`: generate an ATS optimized resume for one job.
- `POST /jobs/{job_id}/apply`: run a Greenhouse, Lever, or Workday application automation dry run by default.

## Standard-library ATS service

The standalone ATS service uses only the Python standard library. Run it on another port when the FastAPI job agent is already using `8000`.

```bash
python3 -m service.app --host 127.0.0.1 --port 8001
```

Health check:

```bash
curl http://127.0.0.1:8001/health
```

Optimize a resume:

```bash
curl -X POST http://127.0.0.1:8001/optimize \
  -H "Content-Type: application/json" \
  -d '{"master_resume":"Paste resume text here","job_description":"Paste job description here"}'
```

The `/optimize` response includes `ats_keywords`, `matched_keywords`, `missing_keywords`, `rewritten_bullets`, `optimized_resume_text`, `ats_match_score`, and a base64 `pdf_base64` payload for `ats-optimized-resume.pdf`.

## Frontend setup

```bash
npm install
npm run dev
```

The dashboard calls `http://localhost:8000` by default. Override with:

```bash
export VITE_API_BASE_URL="http://localhost:8000"
```

## Tests

```bash
cd backend
python3 -m pytest
```

```bash
python3 -m unittest discover -s tests
```

```bash
npm run build
```
