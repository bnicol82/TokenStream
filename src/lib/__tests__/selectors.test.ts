import { describe, expect, it } from 'vitest'
import {
  avgCostPer1k,
  budgetUsage,
  filterByDays,
  fmtMoneyShort,
  fmtTokens,
  freeModelSavings,
  projectSpent,
  savedPct,
  spendByProject,
  spendByProvider,
  totalSaved,
  totalSpend,
  totalTokens,
} from '../selectors'
import type { Transaction } from '../types'

const txn = (over: Partial<Transaction> = {}): Transaction => ({
  id: Math.random().toString(36).slice(2),
  ts: Date.now(),
  provider: 'OpenAI',
  model: 'GPT-4o',
  tag: 'General',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 2,
  baseCost: 5,
  optimized: true,
  projectId: null,
  ...over,
})

describe('spend aggregations', () => {
  const txns = [txn({ cost: 2, baseCost: 5 }), txn({ cost: 3, baseCost: 10 })]

  it('totals spend, savings, and percentage saved', () => {
    expect(totalSpend(txns)).toBe(5)
    expect(totalSaved(txns)).toBe(10)
    expect(savedPct(txns)).toBe(67) // 10 of 15 base
  })

  it('handles empty input without dividing by zero', () => {
    expect(totalSpend([])).toBe(0)
    expect(savedPct([])).toBe(0)
    expect(avgCostPer1k([])).toBe(0)
  })

  it('sums tokens and computes average cost per 1k tokens', () => {
    expect(totalTokens(txns)).toBe(3000)
    expect(avgCostPer1k(txns)).toBeCloseTo((5 / 3000) * 1000)
  })
})

describe('freeModelSavings', () => {
  it('counts only paid-model spend as avoidable', () => {
    const txns = [
      txn({ model: 'GPT-4o', cost: 4 }),
      txn({ model: 'Gemini 2.0 Flash', cost: 0 }), // free-tier model
    ]
    expect(freeModelSavings(txns)).toBe(4)
  })
})

describe('grouping selectors', () => {
  const txns = [
    txn({ provider: 'OpenAI', cost: 3, projectId: 'p1' }),
    txn({ provider: 'Anthropic', cost: 7, projectId: null }),
    txn({ provider: 'OpenAI', cost: 1, projectId: 'p1' }),
  ]

  it('groups spend by provider, largest first', () => {
    expect(spendByProvider(txns)).toEqual([
      { provider: 'Anthropic', cost: 7 },
      { provider: 'OpenAI', cost: 4 },
    ])
  })

  it('groups spend by project with null mapped to Unassigned', () => {
    expect(spendByProject(txns)).toEqual([
      { projectId: 'Unassigned', cost: 7 },
      { projectId: 'p1', cost: 4 },
    ])
  })

  it('projectSpent scopes to one project (or Unassigned via null)', () => {
    expect(projectSpent(txns, 'p1')).toBe(4)
    expect(projectSpent(txns, null)).toBe(7)
  })
})

describe('budgetUsage', () => {
  const txns = [
    txn({ cost: 3, inputTokens: 100, outputTokens: 50, projectId: 'p1' }),
    txn({ cost: 7, inputTokens: 200, outputTokens: 100, projectId: 'p2' }),
  ]

  it('covers all usage for a global budget', () => {
    expect(budgetUsage(txns, {})).toEqual({ spent: 10, tokens: 450 })
  })

  it('scopes usage to a project budget', () => {
    expect(budgetUsage(txns, { projectId: 'p1' })).toEqual({ spent: 3, tokens: 150 })
  })
})

describe('filterByDays', () => {
  it('keeps only transactions within the window', () => {
    const now = Date.now()
    const txns = [txn({ ts: now }), txn({ ts: now - 10 * 86400000 })]
    expect(filterByDays(txns, 7)).toHaveLength(1)
    expect(filterByDays(txns, 30)).toHaveLength(2)
  })
})

describe('formatters', () => {
  it('fmtTokens abbreviates thousands and millions', () => {
    expect(fmtTokens(999)).toBe('999')
    expect(fmtTokens(1500)).toBe('1.5k')
    expect(fmtTokens(2_500_000)).toBe('2.5M')
  })

  it('fmtMoneyShort abbreviates thousands', () => {
    expect(fmtMoneyShort(12.5)).toBe('$12.50')
    expect(fmtMoneyShort(1500)).toBe('$1.5K')
  })
})
