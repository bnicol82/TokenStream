# AGENTS.md

## Cursor Cloud specific instructions

TokenStream is a single Vite + React + TypeScript SPA (an AI token spend tracking dashboard). There is no separate backend service to run for local development — the app runs **entirely on `localStorage`** by default and seeds demo data on first load. Supabase (`supabase/`) is an optional, opt-in backend; it is not required to run, lint, build, or test the app.

- Dependencies are installed by the startup update script (`npm install`). No system dependencies are needed beyond Node (Node 22 is used here).
- Run the app (dev mode): `npm run dev` — serves on `http://localhost:5173/`. This is the development run mode and does NOT type-check, so it starts cleanly even though `npm run build` currently reports type errors (see below).
- Lint: `npm run lint`. Build: `npm run build` (`tsc -b && vite build`). Tests: `npm test` (Vitest, unit tests under `src/lib/__tests__/`). Preview a prod build: `npm run preview`.
- Build, lint, and tests are all expected to pass. CI (`.github/workflows/deploy-pages.yml`) runs lint + tests + type-checked build on every push to `main`.
- Optional Supabase wiring: copy env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` into a `.env` file to switch the data layer to Supabase. The Anthropic-backed chat uses a Supabase Edge Function. See `SUPABASE_SETUP.md`. None of this is needed for normal local development.
