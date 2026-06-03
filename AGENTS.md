# AGENTS.md

## Cursor Cloud specific instructions

### Product

Single **Vite + React + TypeScript** SPA (`ai-resume-analyzer`). All resume/JD analysis runs in the browser via `src/resumeAgent.ts` — no backend, database, Docker, or API keys.

### Required service

| Service | Command | URL |
|---------|---------|-----|
| Vite dev server | `npm run dev` | http://127.0.0.1:5173 (default) |

Optional: `npm run build` then `npm run preview` to serve the production bundle from `dist/`.

### Standard commands

See `README.md` and `package.json` scripts:

- **Install:** `npm install`
- **Dev:** `npm run dev`
- **Build:** `npm run build` (runs `tsc --noEmit` then `vite build`)
- **Preview:** `npm run preview` (after build)

There is no ESLint or automated test script in-repo. Use `npx tsc --noEmit` as the static check equivalent to lint.

### Dev server notes

- Use tmux for long-running `npm run dev` (e.g. session `vite-dev-server`).
- Bind explicitly when testing from automation: `npm run dev -- --host 127.0.0.1 --port 5173`
- No environment variables are required.

### Hello-world / E2E smoke test

1. Start the dev server.
2. Open http://127.0.0.1:5173/
3. Click **Try sample analysis** — expect match score > 0, grade not `N/A`, and populated keyword/ATS sections.
