# AI Resume Analyzer

A user-friendly dashboard that compares a resume against a target job description, scores the match, checks ATS readiness, and generates an ATS-friendly resume rewrite plus a job application package.

## Features

- Paste or upload a text resume.
- Paste any job description for instant analysis.
- View an overall resume-to-JD score, keyword coverage, ATS readiness, and missing keywords.
- Review ATS formatting issues and section checks.
- Use the local resume rewrite agent to create a clean, single-column, ATS-friendly draft.
- Generate a job application automation packet with apply readiness, a workflow checklist, cover letter, recruiter message, answer bank, follow-up plan, and tracker fields.
- Copy or download the rewritten resume as a text file.
- Copy or download the full job application packet as a text file.

## Getting started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Notes

The analyzer and application agent run locally in the browser with deterministic scoring logic. Generated rewrites, cover letters, recruiter messages, and application answers are structured drafts and may include placeholders when the original resume lacks verified details. Replace placeholders with accurate experience before applying or submitting any application.
