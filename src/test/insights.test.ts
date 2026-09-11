import { describe, expect, it } from 'vitest'
import { generateInsights, type InsightCtx } from '../metrics/insights'
import { emptyTotals } from '../metrics/kpis'

function makeCtx(over: Partial<InsightCtx> = {}): InsightCtx {
  const cur = { ...emptyTotals(), days: 30, orders: 5000, revenue: 4e6, cogs: 2.6e6, fulfillmentCost: 120e3, lateDeliveries: 260, returns: 100, targetRevenue: 4.2e6, ticketsOpened: 250, ticketsResolved: 240 }
  const prev = { ...emptyTotals(), days: 30, orders: 4800, revenue: 3.6e6, cogs: 2.4e6, fulfillmentCost: 110e3, lateDeliveries: 240, returns: 90, targetRevenue: 3.8e6, ticketsOpened: 230, ticketsResolved: 235 }
  return {
    days: 30,
    cur,
    prev,
    byRegion: [{ key: 'APAC', totals: cur, prevTotals: prev }],
    byChannel: [],
    onTimePct: 94.8,
    prevOnTimePct: 95.0,
    slaAttainPct: 96,
    openBacklog: 12,
    overdueOpen: 0,
    outOfStock: 0,
    belowLeadTime: 1,
    topCustomerSharePct: 22,
    lateOrderDrivers: [{ reason: 'Carrier delay', count: 40 }],
    ...over,
  }
}

describe('generateInsights', () => {
  it('highlights strong revenue growth', () => {
    const list = generateInsights(makeCtx())
    const rev = list.find((i) => i.id === 'revenue-move')
    expect(rev).toBeDefined()
    expect(rev!.severity).toBe('positive')
    expect(rev!.title).toContain('up 11.1%')
  })

  it('flags behind-plan attainment', () => {
    const list = generateInsights(makeCtx({ cur: { ...makeCtx().cur, revenue: 3.5e6 } }))
    const a = list.find((i) => i.id === 'attainment')
    expect(a?.severity).toBe('warning')
  })

  it('escalates on-time collapse to critical', () => {
    const list = generateInsights(makeCtx({ onTimePct: 84 }))
    const ot = list.find((i) => i.id === 'ontime')
    expect(ot?.severity).toBe('critical')
    expect(ot?.body).toContain('Carrier delay')
  })

  it('surfaces inventory risk with hard numbers', () => {
    const list = generateInsights(makeCtx({ outOfStock: 2, belowLeadTime: 5 }))
    const inv = list.find((i) => i.id === 'stock')
    expect(inv?.title).toContain('2 SKUs out of stock')
  })

  it('falls back to an "all good" note when nothing trips', () => {
    const ctx = makeCtx({ cur: { ...makeCtx().prev } })
    const list = generateInsights(ctx)
    expect(list[0].id).toBe('all-good')
  })

  it('sorts criticals first and caps at 6', () => {
    const list = generateInsights(makeCtx({ onTimePct: 80, outOfStock: 5, belowLeadTime: 9, slaAttainPct: 70, overdueOpen: 12 }))
    expect(list.length).toBeLessThanOrEqual(6)
    expect(list[0].severity).toBe('critical')
  })
})
