-- TokenStream database schema for Supabase (Postgres).
-- Run this in the Supabase SQL editor, or via `supabase db push` with a migration.
-- Every table is scoped to the authenticated user via Row Level Security.

-- ------------------------------------------------------------------ helpers
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ workspaces
-- Tenancy unit. Every account has a personal workspace; teams share one.
-- Spend data (transactions/projects/budgets) is shared across members;
-- conversations stay private to each member (see RLS below).
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'Personal',
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  email        text,                       -- denormalized for member-list display
  role         text not null default 'member' check (role in ('owner','member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  code         text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by   uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- Membership checks. SECURITY DEFINER so they bypass RLS — essential to avoid
-- infinite recursion when workspace-scoped policies reference membership.
create or replace function public.is_member(ws uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid())
$$;

create or replace function public.is_owner(ws uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- Join a workspace via invite code. SECURITY DEFINER so a not-yet-member can
-- insert their own membership without an INSERT policy hole.
create or replace function public.accept_invite(invite_code text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  select workspace_id into ws from public.workspace_invites where code = invite_code;
  if ws is null then raise exception 'Invalid invite code'; end if;
  insert into public.workspace_members (workspace_id, user_id, email, role)
  values (ws, auth.uid(), (auth.jwt() ->> 'email'), 'member')
  on conflict (workspace_id, user_id) do nothing;
  return ws;
end $$;

-- ------------------------------------------------------------------ tables

create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  ts            timestamptz not null default now(),
  provider      text not null,
  model         text not null,
  tag           text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost          numeric(12,4) not null default 0,
  base_cost     numeric(12,4) not null default 0,
  optimized     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  category    text not null check (category in ('personal','tax','team')),
  budget_limit numeric(12,2) not null,
  spent       numeric(12,2) not null default 0,
  token_used  bigint not null default 0,
  token_cap   bigint not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'New Chat',
  tag        text not null default 'General',
  tag_color  text not null default '#f0915a',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  text            text not null,
  model           text,
  opt             text,
  cost            numeric(12,4),
  usage           jsonb,
  roi_tag         text,
  created_at      timestamptz not null default now()
);

-- Singleton-per-user settings rows
create table if not exists public.optimization_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  route_idx  integer[] not null default '{6,1,2,4,6}',
  aggr       integer not null default 60,
  engine_on  boolean not null default true,
  caching    boolean not null default true,
  trim       boolean not null default true,
  applied    boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  threshold  integer not null default 85,
  channels   jsonb not null default '{"Email":true,"Slack":true,"In-App":true}',
  updated_at timestamptz not null default now()
);

-- User-registered AI models, shown alongside the built-in catalog.
create table if not exists public.custom_models (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  provider   text not null,
  price_in   numeric(12,4) not null default 0,
  price_out  numeric(12,4) not null default 0,
  speed      integer not null default 3,
  cost       integer not null default 3,
  quality    integer not null default 3,
  created_at timestamptz not null default now()
);

-- Live provider integrations. CONNECTION METADATA ONLY — safe for the client to
-- read. The actual API key lives in provider_secrets (below), which the browser
-- can never read; only the `providers` Edge Function (service role) touches it.
create table if not exists public.provider_connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  provider       text not null,
  status         text not null default 'connected', -- connected | error
  mode           text not null default 'live',      -- live | sandbox
  key_hint       text,                              -- last 4 chars, e.g. "••••a1b2"
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  unique (user_id, provider)
);

-- Encrypted API keys. RLS is enabled with NO policies, so the anon/auth client
-- gets nothing back (default-deny). Only the service role (Edge Functions)
-- bypasses RLS to read/write here. Keys are AES-GCM encrypted at rest by the
-- `providers` function using the PROVIDER_ENC_KEY secret, so a DB leak alone
-- does not expose plaintext keys.
create table if not exists public.provider_secrets (
  user_id    uuid not null references auth.users (id) on delete cascade,
  provider   text not null,
  iv         text not null,         -- base64 AES-GCM nonce
  ciphertext text not null,         -- base64 encrypted key
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- User-defined projects for tracking AI cost per initiative. Distinct from the
-- task `tag` (work type) — a project can span many task types.
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null default '#5b8dff',
  keywords   text[] not null default '{}',
  budget     numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Project assignment for usage + chats. Nullable (null = Unassigned). No hard FK
-- so deleting a project is a simple app-side nulling, not a cascade.
alter table public.transactions  add column if not exists project_id uuid;
alter table public.conversations add column if not exists project_id uuid;
-- Pinned chat model (null = Auto / cheapest routing).
alter table public.conversations add column if not exists model_name text;
-- Budget scope (null = all usage, else a specific project).
alter table public.budgets add column if not exists project_id uuid;
-- OpenRouter (and other gateway) model id for custom models.
alter table public.custom_models add column if not exists api_model text;
-- Workspace tenancy. transactions/projects/budgets are shared by workspace;
-- conversations carry it for filtering but stay private to the user.
alter table public.transactions  add column if not exists workspace_id uuid;
alter table public.projects      add column if not exists workspace_id uuid;
alter table public.budgets       add column if not exists workspace_id uuid;
alter table public.conversations add column if not exists workspace_id uuid;

-- Dedup + provenance for transactions. external_id lets the sync upsert without
-- creating duplicate rows on re-sync; source distinguishes manual/chat/sync.
-- The unique index is intentionally NOT partial: PostgREST's onConflict can only
-- name columns, and Postgres can't infer a partial index from that. A plain
-- unique index works because NULL external_ids (manual/chat rows) are treated as
-- distinct, so they never collide.
alter table public.transactions add column if not exists source      text not null default 'manual';
alter table public.transactions add column if not exists external_id text;
drop index if exists public.transactions_external_idx;
create unique index if not exists transactions_external_idx
  on public.transactions (user_id, external_id);

-- ------------------------------------------------------------------ indexes
create index if not exists transactions_user_ts_idx on public.transactions (user_id, ts desc);
create index if not exists transactions_ws_idx on public.transactions (workspace_id, ts desc);
create index if not exists projects_ws_idx on public.projects (workspace_id);
create index if not exists budgets_ws_idx on public.budgets (workspace_id);
create index if not exists conversations_ws_idx on public.conversations (user_id, workspace_id, created_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

-- ------------------------------------------------------------------ RLS
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.workspace_invites     enable row level security;
alter table public.transactions          enable row level security;
alter table public.budgets               enable row level security;
alter table public.conversations         enable row level security;
alter table public.messages              enable row level security;
alter table public.optimization_settings enable row level security;
alter table public.alert_settings        enable row level security;
alter table public.custom_models         enable row level security;
alter table public.provider_connections  enable row level security;
alter table public.projects               enable row level security;

-- provider_secrets: RLS on, but intentionally NO policy below. Default-deny
-- means the browser can neither read nor write keys — only the service role
-- (Edge Functions) can. This is the whole point of the split-table design.
alter table public.provider_secrets      enable row level security;

-- ---- workspace tenancy policies (use SECURITY DEFINER is_member/is_owner) ----
drop policy if exists "ws read" on public.workspaces;
create policy "ws read" on public.workspaces for select using (public.is_member(id));
drop policy if exists "ws insert" on public.workspaces;
create policy "ws insert" on public.workspaces for insert with check (owner_id = auth.uid());
drop policy if exists "ws modify" on public.workspaces;
create policy "ws modify" on public.workspaces for update using (public.is_owner(id)) with check (public.is_owner(id));
drop policy if exists "ws delete" on public.workspaces;
create policy "ws delete" on public.workspaces for delete using (public.is_owner(id));

drop policy if exists "wm read" on public.workspace_members;
create policy "wm read" on public.workspace_members for select using (public.is_member(workspace_id));
drop policy if exists "wm owner manage" on public.workspace_members;
create policy "wm owner manage" on public.workspace_members for all
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
drop policy if exists "wm leave" on public.workspace_members;
create policy "wm leave" on public.workspace_members for delete using (user_id = auth.uid());

drop policy if exists "wi owner" on public.workspace_invites;
create policy "wi owner" on public.workspace_invites for all
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

-- ---- workspace-shared data: members share; legacy null rows stay owner-visible ----
do $$
declare t text;
begin
  foreach t in array array['transactions','budgets','projects']
  loop
    execute format($f$
      drop policy if exists "own rows" on public.%1$s;
      drop policy if exists "ws rows" on public.%1$s;
      create policy "ws rows" on public.%1$s
        for all
        using (public.is_member(workspace_id) or (workspace_id is null and user_id = auth.uid()))
        with check (public.is_member(workspace_id) or (workspace_id is null and user_id = auth.uid()));
    $f$, t);
  end loop;
end $$;

-- ---- per-user data (incl. private conversations + messages) ----
do $$
declare t text;
begin
  foreach t in array array[
    'conversations','messages','optimization_settings','alert_settings',
    'custom_models','provider_connections'
  ]
  loop
    execute format($f$
      drop policy if exists "own rows" on public.%1$s;
      create policy "own rows" on public.%1$s
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;
