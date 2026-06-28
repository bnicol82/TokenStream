# AGENTS.md

## Cursor Cloud specific instructions

TokenStream is a single Vite + React + TypeScript SPA (an AI token spend tracking dashboard). There is no separate backend service to run for local development — the app runs **entirely on `localStorage`** by default and seeds demo data on first load. Supabase (`supabase/`) is an optional, opt-in backend; it is not required to run, lint, build, or test the app.

- Dependencies are installed by the startup update script (`npm install`). No system dependencies are needed beyond Node (Node 22 is used here).
- Run the app (dev mode): `npm run dev` — serves on `http://localhost:5173/`. This is the development run mode and does NOT type-check, so it starts cleanly even though `npm run build` currently reports type errors (see below).
- Lint: `npm run lint`. Build: `npm run build` (`tsc -b && vite build`). Preview a prod build: `npm run preview`.
- Known pre-existing failures (NOT environment issues; do not "fix" as part of setup):
  - `npm run build` fails on TypeScript errors (`CustomModel` missing `sav` property in `src/lib/store.tsx`, `Chat.tsx`, `Optimization.tsx`, `SpendTracking.tsx`).
  - `npm run lint` reports errors, mostly `@typescript-eslint/no-explicit-any` in `supabase/functions/*` Deno edge functions plus a `react-hooks/purity` warning in `Overview.tsx`.
- Optional Supabase wiring: copy env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` into a `.env` file to switch the data layer to Supabase. The Anthropic-backed chat uses a Supabase Edge Function. See `SUPABASE_SETUP.md`. None of this is needed for normal local development.
