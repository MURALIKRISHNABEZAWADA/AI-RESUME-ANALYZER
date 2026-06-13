# AI Resume Analyzer

A user-friendly dashboard that compares a resume against a target job description, scores the match, checks ATS readiness, and generates an ATS-friendly resume rewrite draft.

## Features

- Paste or upload a text resume.
- Paste any job description for instant analysis.
- View an overall resume-to-JD score, keyword coverage, ATS readiness, and missing keywords.
- Review ATS formatting issues and section checks.
- Use the local resume rewrite agent to create a clean, single-column, ATS-friendly draft.
- Copy or download the rewritten resume as a text file.
- Run the Python ATS service to extract keywords, rewrite bullets, calculate a match score, and return an ATS-optimized PDF.
- Use the job application agent to prepare a human-reviewed application packet with company/role details, cover letter, form-field map, submission checklist, risk guardrails, and an application queue.

## Getting started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Python ATS service

The service uses only the Python standard library.

```bash
python3 -m service.app --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Optimize a resume:

```bash
curl -X POST http://127.0.0.1:8000/optimize \
  -H "Content-Type: application/json" \
  -d '{"master_resume":"Paste resume text here","job_description":"Paste job description here"}'
```

The `/optimize` response includes `ats_keywords`, `matched_keywords`, `missing_keywords`, `rewritten_bullets`, `optimized_resume_text`, `ats_match_score`, and a base64 `pdf_base64` payload for `ats-optimized-resume.pdf`.

Plan a job application packet:

```bash
curl -X POST http://127.0.0.1:8000/applications/plan \
  -H "Content-Type: application/json" \
  -d '{"master_resume":"Paste resume text here","job_description":"Paste job description here","company_name":"Acme","role_title":"Frontend Engineer","job_url":"https://jobs.example.com/frontend-engineer"}'
```

The `/applications/plan` response includes readiness scoring, portal detection, checklist items, field mappings, cover letter and outreach drafts, risk guardrails, and an `application_packet` text payload. The agent intentionally prepares materials for review; it does not submit applications to third-party portals.

## Python tests

```bash
python3 -m unittest discover -s tests
```

## Notes

The analyzer and application agent run locally with deterministic scoring logic. Generated resumes, cover letters, field maps, and outreach messages are structured drafts and may include placeholders when the original resume lacks verified details. Replace placeholders with accurate experience and manually review every portal page before applying.
