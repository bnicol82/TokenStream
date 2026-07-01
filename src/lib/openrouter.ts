// OpenRouter model catalog. OpenRouter is a gateway — one key unlocks many
// models. We fetch its public /models list so users can browse + add models to
// their catalog and use them in chat (routed through OpenRouter).

export interface OpenRouterModel {
  id: string // e.g. "openai/gpt-4o"
  name: string // friendly label
  priceIn: number // $ / 1M input tokens
  priceOut: number // $ / 1M output tokens
  contextLength: number
}

// Popular fallback if the live fetch is blocked (offline, CORS, etc.).
const FALLBACK: OpenRouterModel[] = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', priceIn: 2.5, priceOut: 10, contextLength: 128000 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', priceIn: 0.15, priceOut: 0.6, contextLength: 128000 },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', priceIn: 3, priceOut: 15, contextLength: 200000 },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', priceIn: 0.8, priceOut: 4, contextLength: 200000 },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', priceIn: 0.1, priceOut: 0.4, contextLength: 1000000 },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', priceIn: 0.12, priceOut: 0.3, contextLength: 131072 },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', priceIn: 2, priceOut: 6, contextLength: 128000 },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', priceIn: 0.55, priceOut: 2.19, contextLength: 64000 },
  { id: 'x-ai/grok-2-1212', name: 'Grok 2', priceIn: 2, priceOut: 10, contextLength: 131072 },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', priceIn: 0.23, priceOut: 0.4, contextLength: 131072 },
]

let cache: OpenRouterModel[] | null = null

// Raw shape of an entry in OpenRouter's public /models response.
interface OpenRouterApiModel {
  id: string
  name?: string
  pricing?: { prompt?: string; completion?: string }
  context_length?: number
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (cache) return cache
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models')
    if (!res.ok) throw new Error(`OpenRouter /models ${res.status}`)
    const json = (await res.json()) as { data?: OpenRouterApiModel[] }
    const list: OpenRouterModel[] = (json?.data ?? [])
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        priceIn: Number(m.pricing?.prompt ?? 0) * 1e6,
        priceOut: Number(m.pricing?.completion ?? 0) * 1e6,
        contextLength: m.context_length ?? 0,
      }))
      .filter((m: OpenRouterModel) => m.id)
      .sort((a: OpenRouterModel, b: OpenRouterModel) => a.name.localeCompare(b.name))
    cache = list.length ? list : FALLBACK
    return cache
  } catch {
    cache = FALLBACK
    return cache
  }
}

// Map a 1-5 "cost" rating from $/1M output price (5 = cheapest/free).
export function costRating(priceOut: number): number {
  if (priceOut <= 0) return 5
  if (priceOut < 1) return 5
  if (priceOut < 4) return 4
  if (priceOut < 10) return 3
  if (priceOut < 20) return 2
  return 1
}
