import { describe, expect, it } from 'vitest'
import {
  MODELS,
  bestFreeModel,
  cheapestModel,
  combinedModels,
  defaultFreeRouteIdx,
  estimateCost,
  estimateForModel,
  fmtMoney,
  freeModels,
  modelByName,
  routedModel,
  savingsLabel,
} from '../models'
import type { CustomModel } from '../types'

const customModel = (over: Partial<CustomModel> = {}): CustomModel => ({
  id: 'cm-1',
  name: 'My Model',
  provider: 'Acme',
  priceIn: 1,
  priceOut: 2,
  speed: 3,
  cost: 3,
  quality: 3,
  ...over,
})

describe('savingsLabel', () => {
  it('labels zero-priced models as Free', () => {
    expect(savingsLabel(0, 0)).toBe('Free')
  })

  it('labels cheaper-than-frontier models with a negative percentage', () => {
    // GPT-4o baseline itself: 0% savings
    expect(savingsLabel(5, 15)).toBe('-0%')
    expect(savingsLabel(0.8, 4)).toMatch(/^-\d+%$/)
  })

  it('labels more-expensive-than-frontier models with a plus percentage', () => {
    expect(savingsLabel(50, 150)).toMatch(/^\+\d+%$/)
  })
})

describe('combinedModels', () => {
  it('returns built-ins followed by custom models', () => {
    const catalog = combinedModels([customModel()])
    expect(catalog).toHaveLength(MODELS.length + 1)
    expect(catalog[catalog.length - 1].name).toBe('My Model')
  })

  it('computes sav and free for custom models', () => {
    const catalog = combinedModels([
      customModel({ id: 'paid', name: 'Paid', priceIn: 1, priceOut: 2 }),
      customModel({ id: 'free', name: 'Zero', priceIn: 0, priceOut: 0 }),
    ])
    const paid = catalog.find((m) => m.name === 'Paid')!
    const zero = catalog.find((m) => m.name === 'Zero')!
    expect(paid.sav).toMatch(/^-\d+%$/)
    expect(paid.free).toBeUndefined()
    expect(zero.sav).toBe('Free')
    expect(zero.free).toBe(true)
    expect(zero.id).toBe('free')
  })

  it('preserves the custom model id for delete/keying in the UI', () => {
    const catalog = combinedModels([customModel({ id: 'abc' })])
    expect(catalog[catalog.length - 1].id).toBe('abc')
  })
})

describe('catalog helpers', () => {
  it('modelByName falls back to the first model for unknown names', () => {
    expect(modelByName('GPT-4o').name).toBe('GPT-4o')
    expect(modelByName('does-not-exist')).toBe(MODELS[0])
  })

  it('bestFreeModel is the highest-quality free model', () => {
    const best = bestFreeModel()
    expect(best.free).toBe(true)
    for (const m of freeModels()) expect(best.quality).toBeGreaterThanOrEqual(m.quality)
  })

  it('defaultFreeRouteIdx routes all five rules to the best free model', () => {
    const idx = defaultFreeRouteIdx()
    expect(idx).toHaveLength(5)
    for (const i of idx) expect(MODELS[i]).toBe(bestFreeModel())
  })

  it('routedModel picks free when engine on, frontier when off', () => {
    expect(routedModel(true).free).toBe(true)
    expect(routedModel(false).name).toBe('GPT-4o')
  })

  it('cheapestModel returns null for an empty catalog and the cheapest otherwise', () => {
    expect(cheapestModel([])).toBeNull()
    const cheapest = cheapestModel([...MODELS])!
    expect(cheapest.priceIn + cheapest.priceOut).toBe(0)
  })
})

describe('cost estimates', () => {
  const opts = { compress: false, route: false, cache: false }

  it('estimateCost with routing off uses the frontier model (no savings)', () => {
    const est = estimateCost('hello world', opts)
    expect(est.routeModelName).toBe('GPT-4o')
    expect(est.savingsPct).toBe(0)
    expect(est.optCost).toBeCloseTo(est.baseCost, 10)
  })

  it('estimateCost with routing on picks a free model and saves 100%', () => {
    const est = estimateCost('hello world', { ...opts, route: true })
    expect(est.savingsPct).toBe(100)
    expect(est.optCost).toBe(0)
  })

  it('compression reduces context tokens and never increases cost', () => {
    const plain = estimateForModel('hello world', opts, modelByName('GPT-4o'))
    const compressed = estimateForModel('hello world', { ...opts, compress: true, aggr: 100 }, modelByName('GPT-4o'))
    expect(compressed.contextTokens).toBeLessThan(plain.contextTokens)
    expect(compressed.optCost).toBeLessThan(plain.optCost)
    expect(compressed.savedTokens).toBeGreaterThan(0)
  })

  it('never returns negative savings', () => {
    const expensive = { ...modelByName('GPT-4o'), priceIn: 500, priceOut: 1500 }
    const est = estimateForModel('hello', opts, expensive)
    expect(est.savingsPct).toBe(0)
  })
})

describe('fmtMoney', () => {
  it('uses 3 decimals under $1 and 2 decimals otherwise', () => {
    expect(fmtMoney(0.1234)).toBe('$0.123')
    expect(fmtMoney(12.345)).toBe('$12.35')
  })
})
