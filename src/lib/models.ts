// Shared model catalog + pricing used across Chat cost estimation, Optimization
// routing rules, and the performance matrix. Prices are per 1M tokens (USD).

import type { CustomModel } from './types'

export interface ModelInfo {
  name: string
  provider: string
  priceIn: number // $ / 1M input tokens
  priceOut: number // $ / 1M output tokens
  speed: number // 1-5
  cost: number // 1-5 (5 = cheapest)
  quality: number // 1-5
  sav: string // headline savings vs frontier, e.g. "-22%"
  free?: boolean // true for free-tier models ($0)
  apiModel?: string // provider model id (e.g. OpenRouter "openai/gpt-4o"); defaults to name
}

export const MODELS: ModelInfo[] = [
  { name: 'GPT-4o', provider: 'OpenAI', priceIn: 5, priceOut: 15, speed: 4, cost: 2, quality: 5, sav: '-22%' },
  { name: 'Claude Sonnet', provider: 'Anthropic', priceIn: 3, priceOut: 15, speed: 4, cost: 3, quality: 5, sav: '-18%' },
  { name: 'o3-mini', provider: 'OpenAI', priceIn: 1.1, priceOut: 4.4, speed: 5, cost: 4, quality: 4, sav: '-31%' },
  { name: 'Gemini 2.5', provider: 'Gemini', priceIn: 1.25, priceOut: 5, speed: 4, cost: 3, quality: 4, sav: '-26%' },
  { name: 'Llama 3.3', provider: 'Together AI', priceIn: 0.8, priceOut: 4, speed: 5, cost: 5, quality: 3, sav: '-44%' },
  { name: 'Mistral Large', provider: 'Mistral', priceIn: 2, priceOut: 6, speed: 4, cost: 4, quality: 4, sav: '-29%' },
  { name: 'Claude Haiku', provider: 'Anthropic', priceIn: 0.8, priceOut: 4, speed: 5, cost: 5, quality: 3, sav: '-38%' },
  { name: 'Grok-3', provider: 'Grok', priceIn: 3, priceOut: 15, speed: 4, cost: 2, quality: 5, sav: '-15%' },
  { name: 'Grok-3 mini', provider: 'Grok', priceIn: 0.3, priceOut: 0.5, speed: 5, cost: 4, quality: 4, sav: '-30%' },
  // Real free-tier models. Appended last so existing routeIdx values stay valid.
  { name: 'Gemini 2.0 Flash', provider: 'Gemini', priceIn: 0, priceOut: 0, speed: 5, cost: 5, quality: 4, sav: 'Free', free: true },
  { name: 'Llama 3.3 70B', provider: 'Groq', priceIn: 0, priceOut: 0, speed: 5, cost: 5, quality: 3, sav: 'Free', free: true },
  { name: 'DeepSeek R1', provider: 'OpenRouter', priceIn: 0, priceOut: 0, speed: 3, cost: 5, quality: 4, sav: 'Free', free: true },
  { name: 'Mistral Small 3', provider: 'Mistral', priceIn: 0, priceOut: 0, speed: 5, cost: 5, quality: 3, sav: 'Free', free: true },
]

export function modelByName(name: string): ModelInfo {
  return MODELS.find((m) => m.name === name) ?? MODELS[0]
}

// Free-tier helpers — single source of truth used by routing, the catalog UI,
// the new-user defaults, and the savings promotions.
export const FREE_MODEL_NAMES = new Set(MODELS.filter((m) => m.free).map((m) => m.name))

export function freeModels(): ModelInfo[] {
  return MODELS.filter((m) => m.free)
}

// Best free model = highest quality among the free tier (Gemini 2.0 Flash).
export function bestFreeModel(): ModelInfo {
  return freeModels().reduce((best, m) => (m.quality > best.quality ? m : best), freeModels()[0])
}

// Default routing for brand-new accounts: every task routed to the best free
// model so the optimization engine pays $0 out of the box.
export function defaultFreeRouteIdx(): number[] {
  const idx = MODELS.indexOf(bestFreeModel())
  return [idx, idx, idx, idx, idx]
}

// The model "smart routing" resolves to. Engine on → best free model; off →
// frontier GPT-4o (the standard baseline we compare savings against).
export function routedModel(engineOn: boolean): ModelInfo {
  return engineOn ? bestFreeModel() : modelByName('GPT-4o')
}

// A catalog entry: a built-in model, or a user-registered custom model (which
// carries its `id` so the UI can manage it).
export type CatalogModel = ModelInfo & { id?: string }

// Headline savings label vs the frontier baseline (GPT-4o) for a typical call
// (1,800 input + 600 output tokens — same mix as the cost estimator).
export function savingsLabel(priceIn: number, priceOut: number): string {
  const cost = 1800 * priceIn + 600 * priceOut
  if (cost <= 0) return 'Free'
  const base = 1800 * 5 + 600 * 15
  const pct = Math.round((1 - cost / base) * 100)
  return pct >= 0 ? `-${pct}%` : `+${-pct}%`
}

// Built-in catalog plus a user's own registered models, used wherever the app
// shows or routes between models (Optimization matrix/rules, manual logging).
// Custom models get a computed savings label and free flag from their pricing.
export function combinedModels(custom: CustomModel[]): CatalogModel[] {
  return [
    ...MODELS,
    ...custom.map((m) => ({
      ...m,
      sav: savingsLabel(m.priceIn, m.priceOut),
      free: m.priceIn <= 0 && m.priceOut <= 0 ? true : undefined,
    })),
  ]
}

export interface CostEstimate {
  inputTokens: number
  contextTokens: number
  outputTokens: number
  totalTokens: number
  optCost: number
  baseCost: number
  savingsPct: number
  savedTokens: number
  routeModelName: string
}

export interface EstimateOpts {
  compress: boolean
  route: boolean
  cache: boolean
  aggr?: number // 0-100, scales compression strength
}

// Shared token math (input/context/output + the frontier baseline cost).
function tokenCalc(text: string, opts: EstimateOpts) {
  const inTok = Math.max(1, Math.ceil(text.length / 4))
  const out = 600
  const ctx0 = 1200
  const base = ((inTok + ctx0) * 5 + out * 15) / 1e6 // vs frontier GPT-4o

  let ctx = ctx0
  if (opts.compress) {
    // aggr 0 -> mild (0.7x), 100 -> strong (0.3x); default 60 ~= 0.45x
    const aggr = opts.aggr ?? 60
    const factor = 0.7 - (aggr / 100) * 0.4
    ctx = Math.round(ctx * factor)
  }
  if (opts.cache) ctx = Math.round(ctx * 0.4)

  return { inTok, out, ctx0, ctx, base }
}

function buildEstimate(text: string, opts: EstimateOpts, model: ModelInfo): CostEstimate {
  const { inTok, out, ctx0, ctx, base } = tokenCalc(text, opts)
  const optCost = ((inTok + ctx) * model.priceIn + out * model.priceOut) / 1e6
  const totalTok = inTok + ctx + out
  const savingsPct = base > 0 ? Math.max(0, Math.round((1 - optCost / base) * 100)) : 0
  return {
    inputTokens: inTok,
    contextTokens: ctx,
    outputTokens: out,
    totalTokens: totalTok,
    optCost,
    baseCost: base,
    savingsPct,
    savedTokens: ctx0 - ctx,
    routeModelName: model.name,
  }
}

// Auto estimate: routing on picks the cheapest (free) model, off uses GPT-4o.
export function estimateCost(text: string, opts: EstimateOpts): CostEstimate {
  return buildEstimate(text, opts, routedModel(opts.route))
}

// Estimate for a specific, user-pinned model.
export function estimateForModel(text: string, opts: EstimateOpts, model: ModelInfo): CostEstimate {
  return buildEstimate(text, opts, model)
}

// Cheapest model in a catalog for a typical prompt; ties prefer free models.
export function cheapestModel(catalog: ModelInfo[]): ModelInfo | null {
  if (catalog.length === 0) return null
  const cost = (m: ModelInfo) => m.priceIn + m.priceOut
  return [...catalog].sort((a, b) => cost(a) - cost(b) || (b.free ? 1 : 0) - (a.free ? 1 : 0))[0]
}

export const fmtMoney = (n: number) => '$' + n.toFixed(n < 1 ? 3 : 2)
