# TokenStream

TokenStream is an AI token spend tracking dashboard. It routes chat tasks to the cheapest capable model, tracks per-call cost against a frontier-model baseline, and rolls everything up into budgets, projects, and analytics.

## Features

- **Overview** — monthly spend vs budget, realized savings, burn-rate projection, recent activity.
- **Chat** — a working chat with per-message cost estimates, prompt compression, smart model routing, and per-conversation model pinning.
- **Spend Tracking** — transaction log with filters, manual usage logging, and live provider sync (OpenAI/Anthropic usage APIs, sandbox mode for the rest).
- **Optimization** — routing rules per task type, compression aggressiveness, a model performance matrix, and custom models (including the live OpenRouter catalog).
- **Budgets & Projects** — spend caps with alert thresholds, project auto-assignment by prompt keywords.
- **Analytics** — spend by provider/project/tag and an exportable report.

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173/
```

By default the app runs **entirely on `localStorage`** and seeds demo data on first load — no backend or API keys needed.

### Scripts

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the dev server (no type-checking)       |
| `npm run build`   | Type-check (`tsc -b`) and build for production|
| `npm run preview` | Serve the production build locally            |
| `npm run lint`    | ESLint over the whole repo                    |
| `npm test`        | Run the unit test suite (Vitest)              |

## Optional Supabase backend

TokenStream can persist to Supabase (auth, multi-workspace teams, real AI chat replies via an Edge Function, and live provider usage sync):

1. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to create the schema (`supabase/schema.sql`) and deploy the `chat` and `providers` Edge Functions.

Provider API keys are never exposed to the browser — the `providers` function validates them, encrypts them with AES-GCM, and stores only ciphertext.

## Architecture

- `src/lib/store.tsx` — central state provider: localStorage persistence, optional Supabase sync, all mutations.
- `src/lib/app-context.ts` — the app context contract and `useApp` hook.
- `src/lib/models.ts` — model catalog, pricing math, cost estimates.
- `src/lib/repo.ts` — Supabase persistence layer (camelCase ↔ snake_case mapping).
- `src/lib/selectors.ts` — spend/savings/budget aggregations.
- `src/pages/*` — one file per dashboard page; `src/components/*` — shared UI.
- `supabase/` — SQL schema and Deno Edge Functions.

## Deployment

Pushes to `main` lint, type-check, build, and deploy to GitHub Pages via `.github/workflows/deploy-pages.yml`. The SPA fallback (`404.html`) keeps deep links working.
