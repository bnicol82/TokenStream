import type { Transaction } from './types'
import { FREE_MODEL_NAMES } from './models'

export function totalSpend(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + t.cost, 0)
}

export function totalBaseSpend(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + t.baseCost, 0)
}

export function totalSaved(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + (t.baseCost - t.cost), 0)
}

export function savedPct(txns: Transaction[]): number {
  const base = totalBaseSpend(txns)
  if (base <= 0) return 0
  return Math.round((totalSaved(txns) / base) * 100)
}

// Spend on paid models — the amount that could move to $0 by switching the same
// work to free-tier models. Powers the "use free models" promotions.
export function freeModelSavings(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + (FREE_MODEL_NAMES.has(t.model) ? 0 : t.cost), 0)
}

// Share of total spend currently going to paid models (0-100).
export function paidSpendPct(txns: Transaction[]): number {
  const total = totalSpend(txns)
  if (total <= 0) return 0
  return Math.round((freeModelSavings(txns) / total) * 100)
}

export function totalTokens(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + t.inputTokens + t.outputTokens, 0)
}

export function avgCostPer1k(txns: Transaction[]): number {
  const tok = totalTokens(txns)
  if (tok <= 0) return 0
  return (totalSpend(txns) / tok) * 1000
}

export function spendByProvider(txns: Transaction[]): { provider: string; cost: number }[] {
  const map = new Map<string, number>()
  for (const t of txns) map.set(t.provider, (map.get(t.provider) ?? 0) + t.cost)
  return [...map.entries()]
    .map(([provider, cost]) => ({ provider, cost }))
    .sort((a, b) => b.cost - a.cost)
}

const UNASSIGNED = 'Unassigned'

// Spend grouped by projectId (null → "Unassigned"). Returns the raw id key so
// callers can resolve project names/colors; null id maps to the UNASSIGNED key.
export function spendByProject(txns: Transaction[]): { projectId: string; cost: number }[] {
  const map = new Map<string, number>()
  for (const t of txns) {
    const key = t.projectId ?? UNASSIGNED
    map.set(key, (map.get(key) ?? 0) + t.cost)
  }
  return [...map.entries()].map(([projectId, cost]) => ({ projectId, cost })).sort((a, b) => b.cost - a.cost)
}

export function tokensByProject(txns: Transaction[]): { projectId: string; tokens: number }[] {
  const map = new Map<string, number>()
  for (const t of txns) {
    const key = t.projectId ?? UNASSIGNED
    map.set(key, (map.get(key) ?? 0) + t.inputTokens + t.outputTokens)
  }
  return [...map.entries()].map(([projectId, tokens]) => ({ projectId, tokens })).sort((a, b) => b.tokens - a.tokens)
}

// Total spent on a specific project (or Unassigned when projectId is null).
export function projectSpent(txns: Transaction[], projectId: string | null): number {
  return txns.reduce((s, t) => s + ((t.projectId ?? null) === projectId ? t.cost : 0), 0)
}

export function projectTokens(txns: Transaction[], projectId: string | null): number {
  return txns.reduce((s, t) => s + ((t.projectId ?? null) === projectId ? t.inputTokens + t.outputTokens : 0), 0)
}

export const UNASSIGNED_KEY = UNASSIGNED

// Live budget usage from transactions. Scoped to a project when set, else all
// usage. Sums all in-scope transactions (no billing-period filter yet).
export function budgetUsage(
  txns: Transaction[],
  budget: { projectId?: string | null },
): { spent: number; tokens: number } {
  const inScope = budget.projectId ? txns.filter((t) => t.projectId === budget.projectId) : txns
  return {
    spent: inScope.reduce((s, t) => s + t.cost, 0),
    tokens: inScope.reduce((s, t) => s + t.inputTokens + t.outputTokens, 0),
  }
}

export function tokensByTag(txns: Transaction[]): { tag: string; tokens: number }[] {
  const map = new Map<string, number>()
  for (const t of txns) map.set(t.tag, (map.get(t.tag) ?? 0) + t.inputTokens + t.outputTokens)
  return [...map.entries()].map(([tag, tokens]) => ({ tag, tokens })).sort((a, b) => b.tokens - a.tokens)
}

export function filterByDays(txns: Transaction[], days: number): Transaction[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return txns.filter((t) => t.ts >= cutoff)
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export function fmtMoneyShort(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}
