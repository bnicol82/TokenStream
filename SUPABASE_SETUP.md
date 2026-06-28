# Connecting TokenStream to Supabase

The app runs fully on `localStorage` out of the box. Follow these steps to move
data + the AI chat to a real Supabase backend. Nothing in the UI changes — the
data layer swaps underneath.

## 1. Create the project
1. Go to <https://supabase.com> → **New project**. Pick a name and a strong
   database password (save it).
2. Once it finishes provisioning, open **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key

## 2. Add the keys to the app
1. In the `TokenStream` folder, copy `.env.example` to `.env`.
2. Paste your values:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```
3. Restart `npm run dev`. `isSupabaseConfigured` is now true.

## 3. Create the tables
1. In the Supabase dashboard open **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
   This creates all tables with Row Level Security so each user only sees their
   own data.

## 4. Wire up the AI chat (Edge Function)
The chat talks to Claude through an Edge Function so your Anthropic key never
ships to the browser.

1. Install the CLI: <https://supabase.com/docs/guides/cli>
2. From the `TokenStream` folder:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy chat
   ```
3. Send a message in the Chat screen — the placeholder `…` is replaced by a real
   Claude response. If the function errors, the app falls back to the built-in
   simulated reply, so chat always works.

## 5. (Next) Persist data to Supabase
Currently reads/writes go through `src/lib/store.tsx` (localStorage). To sync to
Supabase, replace the `setData` bodies with Supabase queries (the table columns
match the `types.ts` shapes). Suggested order:
1. Add email magic-link auth (`supabase.auth.signInWithOtp`).
2. On load, fetch the user's rows instead of `seedData()`.
3. Mirror each action (`addBudget`, `sendMessage`, …) to an `insert`/`update`.
4. Optionally subscribe to realtime changes for multi-device sync.

Until then, everything works locally — connecting Supabase is incremental and
never breaks the running app.
