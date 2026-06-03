# AI Resume Analyzer

A user-friendly dashboard that compares a resume against a target job description, scores the match, checks ATS readiness, and generates an ATS-friendly resume rewrite draft.

## Features

- Paste or upload a text resume.
- Paste any job description for instant analysis.
- View an overall resume-to-JD score, keyword coverage, ATS readiness, and missing keywords.
- Review ATS formatting issues and section checks.
- Use the local resume rewrite agent to create a clean, single-column, ATS-friendly draft.
- Copy or download the rewritten resume as a text file.

## Getting started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

The analyzer runs locally in the browser with deterministic scoring logic. The generated rewrite is a structured draft and may include placeholders when the original resume lacks verified details. Replace placeholders with accurate experience before applying.
