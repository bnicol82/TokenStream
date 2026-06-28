import type { AppData } from './types'
import { projectSpent, budgetUsage } from './selectors'

export interface Alert {
  key: string // stable id, e.g. "budget:<id>" / "project:<id>"
  kind: 'budget' | 'project'
  name: string
  pct: number // 0-100+
  spent: number
  limit: number
  severity: 'warn' | 'over'
}

// Active alerts: any budget or project-budget whose usage has crossed the
// configured threshold %. Global budgets use the stored `spent`; projects are
// computed live from transactions.
export function computeAlerts(data: AppData): Alert[] {
  const threshold = data.alerts.threshold
  const out: Alert[] = []

  for (const b of data.budgets) {
    if (b.limit <= 0) continue
    const spent = budgetUsage(data.transactions, b).spent
    const pct = Math.round((spent / b.limit) * 100)
    if (pct >= threshold) {
      out.push({ key: `budget:${b.id}`, kind: 'budget', name: b.name, pct, spent, limit: b.limit, severity: pct >= 100 ? 'over' : 'warn' })
    }
  }

  for (const p of data.projects) {
    if (p.budget <= 0) continue
    const spent = projectSpent(data.transactions, p.id)
    const pct = Math.round((spent / p.budget) * 100)
    if (pct >= threshold) {
      out.push({ key: `project:${p.id}`, kind: 'project', name: p.name, pct, spent, limit: p.budget, severity: pct >= 100 ? 'over' : 'warn' })
    }
  }

  // Most severe / highest utilization first.
  return out.sort((a, b) => b.pct - a.pct)
}

const SEEN_KEY = 'tokenstream:alerts:seen'

export function readSeenAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function markAlertsSeen(keys: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys))
  } catch {
    /* ignore */
  }
}
