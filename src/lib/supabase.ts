import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Single shared client. Null until env vars are provided — the app runs fully
// on localStorage until then (see lib/store.tsx).
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null

export interface ChatReply {
  text: string
  model: string
}

// Calls the `chat` Edge Function, which calls the real API of whatever model
// routing selected (Gemini / Groq / OpenRouter / Anthropic) so the key stays
// server-side. `model` is the routed model name (e.g. "Gemini 2.0 Flash").
// Throws if not configured or the call fails — callers fall back to the local
// simulator.
export interface ChatModel {
  name: string
  provider?: string
  apiModel?: string // provider model id (e.g. OpenRouter "openai/gpt-4o")
}

export async function callChatFunction(
  messages: { role: 'user' | 'assistant'; content: string }[],
  opts: { compress: boolean; route: boolean; cache: boolean },
  model: ChatModel,
): Promise<ChatReply> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { messages, opts, model },
  })
  if (error) throw error
  return data as ChatReply
}

export interface ProvidersResult {
  ok?: boolean
  inserted?: number
  note?: string | null
  connection?: unknown
  error?: string
}

// Calls the `providers` Edge Function, which holds API keys server-side and
// performs connect / sync / disconnect. Throws on transport/auth failure.
export async function callProvidersFunction(body: {
  action: 'connect' | 'sync' | 'disconnect'
  provider: string
  apiKey?: string
  mode?: 'live' | 'sandbox'
}): Promise<ProvidersResult> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke('providers', { body })
  if (error) {
    // Surface the function's JSON error body when present.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json()
        if (j?.error) return { error: j.error }
      } catch {
        /* fall through */
      }
    }
    throw error
  }
  return data as ProvidersResult
}
