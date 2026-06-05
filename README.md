# AI Resume Analyzer

A user-friendly dashboard that compares a resume against a target job description, scores the match, checks ATS readiness, generates an ATS-friendly resume rewrite draft, and prepares a job application automation kit.

## Features

- Paste or upload a text resume.
- Paste any job description for instant analysis.
- View an overall resume-to-JD score, keyword coverage, ATS readiness, and missing keywords.
- Review ATS formatting issues and section checks.
- Use the local resume rewrite agent to create a clean, single-column, ATS-friendly draft.
- Copy or download the rewritten resume as a text file.
- Use the job application automation agent to generate an application checklist, tailored cover letter, recruiter outreach, reusable form answers, follow-up plan, and tracker CSV.
- Run the Python ATS service to extract keywords, rewrite bullets, calculate a match score, and return an ATS-optimized PDF.

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

## Python tests

```bash
python3 -m unittest discover -s tests
```

## Notes

The analyzer runs locally in the browser with deterministic scoring logic. The generated rewrite is a structured draft and may include placeholders when the original resume lacks verified details. Replace placeholders with accurate experience before applying.

The job application automation agent prepares materials and tracking assets for the application process. It does not submit applications automatically; review every generated claim and apply through the employer's official workflow.
