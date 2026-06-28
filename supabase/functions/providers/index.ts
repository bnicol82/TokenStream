// Supabase Edge Function: `providers`
// Manages live AI-provider integrations: connect (store an encrypted API key),
// sync (pull usage into transactions), and disconnect.
//
// Deploy: supabase functions deploy providers
// Secret:  supabase secrets set PROVIDER_ENC_KEY=<base64 of 32 random bytes>
//          (generate: openssl rand -base64 32)
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the platform.
//
// Security model: API keys NEVER reach the browser. The client sends a key here
// once (over HTTPS); we validate it, AES-GCM encrypt it with PROVIDER_ENC_KEY,
// and store the ciphertext in provider_secrets (service role only — the table
// is RLS default-deny). The client only ever sees provider_connections metadata.
//
// Request body: { action: 'connect'|'sync'|'disconnect', provider: string,
//                 apiKey?: string, mode?: 'live'|'sandbox' }

// @ts-expect-error - Deno std import resolved at deploy time
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-expect-error - esm import resolved at deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENC_KEY_B64 = Deno.env.get('PROVIDER_ENC_KEY') // required for live mode

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Pricing catalog ($ / 1M tokens) used to value synced usage. Mirrors the
// client's models.ts so dashboard costs line up.
const CATALOG: Record<string, { model: string; priceIn: number; priceOut: number }[]> = {
  OpenAI: [
    { model: 'GPT-4o', priceIn: 5, priceOut: 15 },
    { model: 'o3-mini', priceIn: 1.1, priceOut: 4.4 },
  ],
  Anthropic: [
    { model: 'Claude Sonnet', priceIn: 3, priceOut: 15 },
    { model: 'Claude Haiku', priceIn: 0.8, priceOut: 4 },
  ],
  Grok: [{ model: 'Grok-3', priceIn: 3, priceOut: 15 }],
  'Together AI': [{ model: 'Llama 3.3', priceIn: 0.8, priceOut: 4 }],
  Mistral: [{ model: 'Mistral Large', priceIn: 2, priceOut: 6 }],
  Gemini: [{ model: 'Gemini 2.5', priceIn: 1.25, priceOut: 5 }],
  Cohere: [{ model: 'Command R+', priceIn: 2.5, priceOut: 10 }],
  Groq: [{ model: 'Llama 3.3 70B', priceIn: 0, priceOut: 0 }],
  OpenRouter: [{ model: 'DeepSeek R1', priceIn: 0, priceOut: 0 }],
}
const TAGS = ['Tax', 'Research', 'Code', 'Triage', 'General', 'Writing']

// Providers with a real usage API we know how to call. Others can still connect
// (and use sandbox), but a live sync tells the user to log manually.
const LIVE_SYNC_SUPPORTED = new Set(['OpenAI', 'Anthropic'])

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401)

    // Identify the caller from their JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401)
    const userId = userData.user.id

    // Service-role client bypasses RLS for secrets/transactions writes.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const body = await req.json()
    const action = body?.action as string
    const provider = body?.provider as string
    if (!provider || !CATALOG[provider]) return json({ error: 'Unknown provider' }, 400)

    if (action === 'connect') return await connect(admin, userId, provider, body)
    if (action === 'sync') return await sync(admin, userId, provider)
    if (action === 'disconnect') return await disconnect(admin, userId, provider)
    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

// ---- actions --------------------------------------------------------------

async function connect(admin: any, userId: string, provider: string, body: any) {
  const mode = body?.mode === 'sandbox' ? 'sandbox' : 'live'
  const apiKey = (body?.apiKey ?? '').trim()

  if (mode === 'live') {
    if (!apiKey) return json({ error: 'API key required for live mode' }, 400)
    if (!ENC_KEY_B64) return json({ error: 'Server missing PROVIDER_ENC_KEY' }, 500)
    const valid = await validateKey(provider, apiKey)
    if (!valid.ok) return json({ error: `Key validation failed: ${valid.detail}` }, 400)

    const { iv, ciphertext } = await encrypt(apiKey)
    const { error: secErr } = await admin
      .from('provider_secrets')
      .upsert({ user_id: userId, provider, iv, ciphertext })
    if (secErr) return json({ error: `Secret store failed: ${secErr.message}` }, 500)
  } else {
    // Sandbox: no real key stored.
    await admin.from('provider_secrets').delete().eq('user_id', userId).eq('provider', provider)
  }

  const keyHint = mode === 'live' ? '••••' + apiKey.slice(-4) : 'sandbox'
  const { data, error } = await admin
    .from('provider_connections')
    .upsert(
      { user_id: userId, provider, status: 'connected', mode, key_hint: keyHint, last_error: null },
      { onConflict: 'user_id,provider' },
    )
    .select()
    .single()
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, connection: data }, 200)
}

async function sync(admin: any, userId: string, provider: string) {
  const { data: conn } = await admin
    .from('provider_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()
  if (!conn) return json({ error: 'Provider not connected' }, 400)

  let rows: any[] = []
  let note: string | null = null
  try {
    if (conn.mode === 'sandbox') {
      rows = genSandboxUsage(userId, provider)
    } else if (LIVE_SYNC_SUPPORTED.has(provider)) {
      const key = await loadKey(admin, userId, provider)
      rows = await fetchLiveUsage(provider, key, userId)
    } else {
      note = `${provider} has no usage API yet — log usage manually for now.`
    }
  } catch (e) {
    await admin
      .from('provider_connections')
      .update({ status: 'error', last_error: String(e) })
      .eq('user_id', userId)
      .eq('provider', provider)
    return json({ error: String(e) }, 502)
  }

  let inserted = 0
  if (rows.length) {
    const { data, error } = await admin
      .from('transactions')
      .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
      .select('id')
    if (error) return json({ error: error.message }, 500)
    inserted = data?.length ?? 0
  }

  await admin
    .from('provider_connections')
    .update({ status: 'connected', last_synced_at: new Date().toISOString(), last_error: null })
    .eq('user_id', userId)
    .eq('provider', provider)

  return json({ ok: true, inserted, note }, 200)
}

async function disconnect(admin: any, userId: string, provider: string) {
  await admin.from('provider_secrets').delete().eq('user_id', userId).eq('provider', provider)
  await admin.from('provider_connections').delete().eq('user_id', userId).eq('provider', provider)
  return json({ ok: true }, 200)
}

// ---- live provider usage --------------------------------------------------

async function validateKey(provider: string, key: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    if (provider === 'OpenAI') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      return r.ok ? { ok: true } : { ok: false, detail: `OpenAI returned ${r.status}` }
    }
    if (provider === 'Anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      })
      return r.ok ? { ok: true } : { ok: false, detail: `Anthropic returned ${r.status}` }
    }
    // No validator available — accept a non-empty key.
    return key.length > 8 ? { ok: true } : { ok: false, detail: 'key too short' }
  } catch (e) {
    return { ok: false, detail: String(e) }
  }
}

// Best-effort real usage pulls. These hit organization-level usage APIs that
// require ADMIN keys; shapes may need tweaking per org. Failures surface as the
// connection's last_error rather than crashing the sync.
async function fetchLiveUsage(provider: string, key: string, userId: string): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000)
  const start = now - 14 * 86400
  const out: any[] = []

  if (provider === 'OpenAI') {
    const url = `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&bucket_width=1d&limit=14`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
    if (!r.ok) throw new Error(`OpenAI usage API ${r.status}: ${await r.text()}`)
    const data = await r.json()
    for (const bucket of data?.data ?? []) {
      for (const res of bucket?.results ?? []) {
        const inTok = res.input_tokens ?? 0
        const outTok = res.output_tokens ?? 0
        if (!inTok && !outTok) continue
        out.push(
          usageRow(userId, provider, res.model ?? 'GPT-4o', inTok, outTok, bucket.start_time * 1000,
            `oai:${bucket.start_time}:${res.model ?? 'm'}`),
        )
      }
    }
    return out
  }

  if (provider === 'Anthropic') {
    const startIso = new Date(start * 1000).toISOString()
    const url = `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${startIso}&bucket_width=1d`
    const r = await fetch(url, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    })
    if (!r.ok) throw new Error(`Anthropic usage API ${r.status}: ${await r.text()}`)
    const data = await r.json()
    for (const bucket of data?.data ?? []) {
      for (const res of bucket?.results ?? []) {
        const inTok = res.uncached_input_tokens ?? res.input_tokens ?? 0
        const outTok = res.output_tokens ?? 0
        if (!inTok && !outTok) continue
        const ts = new Date(bucket.starting_at ?? Date.now()).getTime()
        out.push(
          usageRow(userId, provider, res.model ?? 'Claude Sonnet', inTok, outTok, ts,
            `ant:${bucket.starting_at}:${res.model ?? 'm'}`),
        )
      }
    }
    return out
  }

  return out
}

// ---- sandbox usage --------------------------------------------------------

// Deterministic-ish realistic usage for the last 14 days so the whole flow is
// verifiable without a real key. external_id is stable per (provider, day, i)
// so repeated syncs upsert rather than duplicate.
function genSandboxUsage(userId: string, provider: string): any[] {
  const models = CATALOG[provider]
  const rows: any[] = []
  let s = hashSeed(userId + provider)
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const perDay = 1 + Math.floor(rnd() * 3)
    for (let i = 0; i < perDay; i++) {
      const m = models[Math.floor(rnd() * models.length)]
      const inTok = 2000 + Math.floor(rnd() * 12000)
      const outTok = 1000 + Math.floor(rnd() * 6000)
      const ts = startOfToday.getTime() - dayOffset * 86400000 + Math.floor(rnd() * 86400000)
      rows.push({
        ...usageRow(userId, provider, m.model, inTok, outTok, ts, `sb:${provider}:${dayOffset}:${i}`),
        tag: TAGS[Math.floor(rnd() * TAGS.length)],
        optimized: rnd() > 0.3,
      })
    }
  }
  return rows
}

// ---- helpers --------------------------------------------------------------

function usageRow(
  userId: string,
  provider: string,
  model: string,
  inTok: number,
  outTok: number,
  ts: number,
  externalId: string,
) {
  const price = CATALOG[provider].find((m) => m.model === model) ?? CATALOG[provider][0]
  const cost = (inTok * price.priceIn + outTok * price.priceOut) / 1e6
  const baseCost = (inTok * 5 + outTok * 15) / 1e6 // vs frontier GPT-4o
  return {
    user_id: userId,
    ts: new Date(ts).toISOString(),
    provider,
    model,
    tag: 'General',
    input_tokens: inTok,
    output_tokens: outTok,
    cost,
    base_cost: Math.max(baseCost, cost),
    optimized: true,
    source: 'sync',
    external_id: externalId,
  }
}

function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 0x7fffffff || 1337
}

// ---- encryption (AES-GCM) -------------------------------------------------

async function importKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(ENC_KEY_B64!), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encrypt(plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const key = await importKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder().encode(plaintext)
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
  return { iv: b64(iv), ciphertext: b64(new Uint8Array(buf)) }
}

async function loadKey(admin: any, userId: string, provider: string): Promise<string> {
  const { data, error } = await admin
    .from('provider_secrets')
    .select('iv, ciphertext')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()
  if (error || !data) throw new Error('No stored key for this provider')
  const key = await importKey()
  const iv = Uint8Array.from(atob(data.iv), (c) => c.charCodeAt(0))
  const ct = Uint8Array.from(atob(data.ciphertext), (c) => c.charCodeAt(0))
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(buf)
}

function b64(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
