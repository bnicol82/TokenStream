// Supabase Edge Function: `chat`
// Multi-provider chat proxy. Calls the REAL API of whatever model routing
// picked (Gemini / Groq / OpenRouter / Anthropic) so "routed to a free model"
// genuinely runs that model. API keys never reach the browser.
//
// Deploy: supabase functions deploy chat
// Secrets (set whichever you want active — all optional):
//   GEMINI_API_KEY      (Google AI Studio — free tier)
//   GROQ_API_KEY        (Groq — free tier)
//   OPENROUTER_API_KEY  (OpenRouter — has :free models)
//   ANTHROPIC_API_KEY   (fallback)
//   PROVIDER_ENC_KEY    (already set for the providers function — enables BYOK)
//
// Request body: { messages: {role,content}[], opts: {compress,route,cache}, model?: string }
// Response:     { text: string, model: string }
//
// Key resolution per request: user's connected key (BYOK, decrypted from
// provider_secrets) → app-funded secret → Anthropic → (client) local simulator.

// @ts-expect-error - Deno std import resolved at deploy time
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-expect-error - esm import resolved at deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENC_KEY_B64 = Deno.env.get('PROVIDER_ENC_KEY')

const APP_KEYS: Record<string, string | undefined> = {
  Gemini: Deno.env.get('GEMINI_API_KEY'),
  Groq: Deno.env.get('GROQ_API_KEY'),
  OpenRouter: Deno.env.get('OPENROUTER_API_KEY'),
  Grok: Deno.env.get('XAI_API_KEY'),
  Anthropic: Deno.env.get('ANTHROPIC_API_KEY'),
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT =
  'You are TokenStream, an assistant embedded in an AI cost-management dashboard. ' +
  'Be concise and helpful. Favor short, well-structured answers that minimize token usage.'

const FRONTIER_MODEL = 'claude-sonnet-4-6'
const ROUTED_ANTHROPIC = 'claude-haiku-4-5-20251001'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

// Model name (as shown in the app) → how to call it.
type Kind = 'gemini' | 'openai' | 'anthropic'
interface ModelCfg {
  providerName: string // matches provider_secrets / APP_KEYS keys
  apiModel: string
  kind: Kind
  endpoint?: string
}
const MODEL_MAP: Record<string, ModelCfg> = {
  'Gemini 2.0 Flash': { providerName: 'Gemini', apiModel: 'gemini-2.0-flash', kind: 'gemini' },
  'Llama 3.3 70B': {
    providerName: 'Groq',
    apiModel: 'llama-3.3-70b-versatile',
    kind: 'openai',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },
  'DeepSeek R1': {
    providerName: 'OpenRouter',
    apiModel: 'deepseek/deepseek-r1:free',
    kind: 'openai',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
  'Grok-3': {
    providerName: 'Grok',
    apiModel: 'grok-3',
    kind: 'openai',
    endpoint: 'https://api.x.ai/v1/chat/completions',
  },
  'Grok-3 mini': {
    providerName: 'Grok',
    apiModel: 'grok-3-mini',
    kind: 'openai',
    endpoint: 'https://api.x.ai/v1/chat/completions',
  },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, opts, model } = await req.json()
    const trimmed: Msg[] = opts?.compress ? (messages as Msg[]).slice(-6) : messages

    // `model` is { name, provider?, apiModel? }. (Older callers may send a string.)
    const modelName: string = typeof model === 'string' ? model : model?.name ?? ''
    const modelProvider: string | undefined = typeof model === 'object' ? model?.provider : undefined
    const modelApiId: string | undefined = typeof model === 'object' ? model?.apiModel : undefined

    // Resolve the target model: a known named model, or any OpenRouter gateway
    // model built on the fly from its provider id.
    let cfg: ModelCfg | null = MODEL_MAP[modelName] ?? null
    if (!cfg && modelProvider === 'OpenRouter' && modelApiId) {
      cfg = {
        providerName: 'OpenRouter',
        apiModel: modelApiId,
        kind: 'openai',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      }
    }

    // BYOK: identify the caller and try their connected key for this provider.
    const authHeader = req.headers.get('Authorization')

    // Attempt the routed provider first, then Anthropic, then signal fallback.
    const attempts: { name: string; cfg: ModelCfg | null }[] = []
    if (cfg) attempts.push({ name: modelName, cfg })
    attempts.push({ name: opts?.route === false ? 'Claude Sonnet' : 'Claude Haiku', cfg: null }) // Anthropic fallback

    let lastErr = 'no provider configured'
    for (const attempt of attempts) {
      const providerName = attempt.cfg?.providerName ?? 'Anthropic'
      const key = await resolveKey(providerName, authHeader)
      if (!key) {
        lastErr = `no key for ${providerName}`
        continue
      }
      try {
        const text = await callProvider(attempt.cfg, key, trimmed, opts)
        if (text) return json({ text, model: attempt.name }, 200)
        lastErr = `empty response from ${providerName}`
      } catch (e) {
        lastErr = `${providerName}: ${String(e)}`
      }
    }

    // Nothing worked — let the client fall back to its local simulator.
    return json({ error: 'No chat provider available', detail: lastErr }, 502)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

// ---- key resolution -------------------------------------------------------

async function resolveKey(providerName: string, authHeader: string | null): Promise<string | null> {
  // 1) BYOK — the user's own connected key, decrypted from provider_secrets.
  if (authHeader && ENC_KEY_B64) {
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
      const { data: userData } = await userClient.auth.getUser()
      const userId = userData?.user?.id
      if (userId) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
        const { data } = await admin
          .from('provider_secrets')
          .select('iv, ciphertext')
          .eq('user_id', userId)
          .eq('provider', providerName)
          .maybeSingle()
        if (data) return await decryptKey(data.iv, data.ciphertext)
      }
    } catch {
      /* fall through to app key */
    }
  }
  // 2) App-funded secret.
  return APP_KEYS[providerName] ?? null
}

// ---- provider callers -----------------------------------------------------

function callProvider(cfg: ModelCfg | null, key: string, messages: Msg[], opts: any): Promise<string> {
  if (!cfg || cfg.kind === 'anthropic') return callAnthropic(key, messages, opts)
  if (cfg.kind === 'gemini') return callGemini(key, cfg.apiModel, messages)
  return callOpenAICompat(cfg.endpoint!, key, cfg.apiModel, messages)
}

async function callAnthropic(key: string, messages: Msg[], opts: any): Promise<string> {
  const apiModel = opts?.route === false ? FRONTIER_MODEL : ROUTED_ANTHROPIC
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: apiModel, max_tokens: 1024, system: SYSTEM_PROMPT, messages }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.content?.[0]?.text ?? ''
}

// Groq + OpenRouter share the OpenAI chat-completions shape.
async function callOpenAICompat(endpoint: string, key: string, apiModel: string, messages: Msg[]): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: apiModel,
      max_tokens: 1024,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

async function callGemini(key: string, apiModel: string, messages: Msg[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ---- AES-GCM decrypt (mirrors providers/index.ts) -------------------------

async function importKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(ENC_KEY_B64!), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function decryptKey(ivB64: string, ctB64: string): Promise<string> {
  const key = await importKey()
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0))
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(buf)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
