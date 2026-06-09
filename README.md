# AI Resume Analyzer

A user-friendly dashboard that compares a resume against a target job description, scores the match, checks ATS readiness, and generates an ATS-friendly resume rewrite draft.

## Features

- Paste or upload a text resume.
- Paste any job description for instant analysis.
- View an overall resume-to-JD score, keyword coverage, ATS readiness, and missing keywords.
- Review ATS formatting issues and section checks.
- Use the local resume rewrite agent to create a clean, single-column, ATS-friendly draft.
- Generate a job application automation package with a readiness score, checklist, application form answers, cover letter, recruiter message, and follow-up plan.
- Copy or download the rewritten resume as a text file.
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

Generate a full application package:

```bash
curl -X POST http://127.0.0.1:8000/application-package \
  -H "Content-Type: application/json" \
  -d '{
    "master_resume": "Paste resume text here",
    "job_description": "Paste job description here",
    "company_name": "Example Co",
    "job_url": "https://example.com/jobs/123",
    "candidate_profile": {
      "full_name": "Your Name",
      "email": "you@example.com",
      "phone": "555-0100",
      "location": "City, State",
      "linkedin": "https://linkedin.com/in/your-profile",
      "work_authorization": "Authorized to work in the United States",
      "sponsorship": "No sponsorship required"
    },
    "include_pdf": false
  }'
```

The `/application-package` response includes the ATS optimization payload plus `readiness_score`, `recommendation`, `checklist`, `suggested_form_answers`, `cover_letter`, `recruiter_message`, `follow_up_plan`, and a lightweight application `tracker`.

## Python tests

```bash
python3 -m unittest discover -s tests
```

## Notes

The analyzer and job application agent run locally with deterministic scoring logic. The generated rewrite, cover letter, and form answers are structured drafts and may include placeholders when the original resume or profile lacks verified details. Replace placeholders with accurate experience before applying. The app prepares application materials but does not store credentials or submit applications for you.
