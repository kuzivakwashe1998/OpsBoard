import { describe, expect, it } from 'vitest'
import { bucketRows, computeKpi, KPI_BY_ID, sumTotals, byDimension, type KpiCtx } from '../metrics/kpis'
import type { DailyRow } from '../data/model'
import { addDaysISO, previousRange, resolveRange, bucketKey, granularityFor } from '../lib/dates'

function row(day: string, over: Partial<DailyRow> = {}): DailyRow {
  return {
    day,
    region: 'North America',
    channel: 'Online',
    orders: 10,
    unitsShipped: 20,
    revenue: 1000,
    cogs: 650,
    fulfillmentCost: 200,
    lateDeliveries: 1,
    returns: 0,
    newCustomers: 1,
    ticketsOpened: 1,
    ticketsResolved: 1,
    firstResponseMinSum: 30,
    inventoryValue: 100,
    stockoutEvents: 0,
    targetRevenue: 950,
    ...over,
  }
}

const ctx: KpiCtx = { openBacklog: 4, slaAttainPct: 96, overdueOpen: 0 }

describe('sumTotals', () => {
  it('sums the core fields', () => {
    const t = sumTotals([row('2026-01-01'), row('2026-01-02', { revenue: 2000, orders: 20 })])
    expect(t.revenue).toBe(3000)
    expect(t.orders).toBe(30)
    expect(t.days).toBe(2)
  })
  it('averages inventory value across days', () => {
    const t = sumTotals([row('2026-01-01', { inventoryValue: 100 }), row('2026-01-02', { inventoryValue: 300 })])
    expect(t.inventoryValueAvg).toBe(200)
  })
  it('handles the empty set', () => {
    const t = sumTotals([])
    expect(t.revenue).toBe(0)
    expect(t.days).toBe(0)
  })
})

describe('bucketRows', () => {
  it('collapses days into Monday-anchored weeks', () => {
    const rows = [row('2026-01-05'), row('2026-01-06'), row('2026-01-12')] // Mon, Tue, next Mon
    const weekly = bucketRows(rows, 'week')
    expect(weekly).toHaveLength(2)
    expect(weekly[0].day).toBe('2026-01-05')
    expect(weekly[0].revenue).toBe(2000) // two days
    expect(weekly[1].revenue).toBe(1000)
  })
  it('keeps days when granularity is day', () => {
    const rows = [row('2026-01-05'), row('2026-01-06')]
    expect(bucketRows(rows, 'day')).toHaveLength(2)
  })
  it('buckets months', () => {
    expect(bucketKey('2026-03-17', 'month')).toBe('2026-03-01')
    expect(granularityFor(730)).toBe('month')
    expect(granularityFor(90)).toBe('day')
    expect(granularityFor(200)).toBe('week')
  })
})

describe('KPIs', () => {
  const cur = sumTotals([row('2026-01-01'), row('2026-01-02')])
  const prev = sumTotals([row('2026-01-03', { revenue: 1000, orders: 10 }), row('2026-01-04', { revenue: 500, orders: 10 })])

  it('computes revenue with a percentage delta', () => {
    const k = computeKpi(KPI_BY_ID.get('revenue')!, cur, prev, ctx, ctx, [])
    expect(k.value).toBe(2000)
    expect(k.prevValue).toBe(1500)
    expect(k.delta).toBeCloseTo(33.333, 2)
  })

  it('computes gross margin as a pp delta', () => {
    const k = computeKpi(KPI_BY_ID.get('grossMargin')!, cur, prev, ctx, ctx, [])
    // cur: (2000-1300)/2000 = 35%
    expect(k.value).toBeCloseTo(35, 6)
    // prev: (1500-1300)/1500 = 13.33% → delta in pp
    expect(k.prevValue).toBeCloseTo(13.3333, 3)
    expect(k.delta).toBeCloseTo(21.6667, 3)
    expect(k.status).toBe('ok')
  })

  it('treats "down is good" metrics correctly on status', () => {
    const k = computeKpi(KPI_BY_ID.get('fpo')!, cur, prev, ctx, ctx, [])
    // fulfillment 400 / 20 orders = 20 → ≤27 → ok
    expect(k.value).toBe(20)
    expect(k.status).toBe('ok')
  })

  it('handles zero baselines without Infinity', () => {
    const k = computeKpi(KPI_BY_ID.get('revenue')!, cur, sumTotals([]), ctx, ctx, [])
    expect(k.delta).toBeNull()
  })

  it('backlog uses the context, not the daily totals', () => {
    const k = computeKpi(KPI_BY_ID.get('backlog')!, cur, prev, { ...ctx, openBacklog: 999 }, ctx, [])
    expect(k.value).toBe(999)
    expect(k.status).toBe('risk')
  })
})

describe('byDimension', () => {
  it('splits by channel and computes share totals', () => {
    const rows = [row('2026-01-01'), row('2026-01-01', { channel: 'Retail', revenue: 3000 })]
    const slices = byDimension(rows, 'channel', rows, [])
    expect(slices.map((s) => s.key).sort()).toEqual(['Online', 'Retail'])
    const retail = slices.find((s) => s.key === 'Retail')!
    expect(retail.totals.revenue).toBe(3000)
  })
})

describe('date ranges', () => {
  it('resolves presets against the data window', () => {
    const r = resolveRange('30d', null, '2024-01-01', '2026-01-31')
    expect(r.end).toBe('2026-01-31')
    expect(r.start).toBe('2026-01-02')
  })
  it('clamps custom ranges into history', () => {
    const r = resolveRange('custom', { start: '2020-01-01', end: '2026-02-05' }, '2024-06-01', '2026-01-31')
    expect(r.start).toBe('2024-06-01')
    expect(r.end).toBe('2026-01-31')
  })
  it('previous range is adjacent and same length', () => {
    const r = { start: '2026-01-02', end: '2026-01-31' }
    const p = previousRange(r)
    expect(p.end).toBe('2026-01-01')
    expect(p.start).toBe('2025-12-03')
  })
  it('addDaysISO round trips', () => {
    expect(addDaysISO(addDaysISO('2026-01-31', 10), -10)).toBe('2026-01-31')
  })
})
