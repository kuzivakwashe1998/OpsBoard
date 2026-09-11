import { describe, expect, it } from 'vitest'
import { buildDataset } from '../data/dataset'
import { REGIONS, CHANNELS, CATEGORIES } from '../data/model'

const TODAY = '2026-06-15'
const SEED = 1234

describe('dataset generator', () => {
  const ds = buildDataset(SEED, TODAY)

  it('is deterministic for a given seed', () => {
    const ds2 = buildDataset(SEED, TODAY)
    expect(JSON.stringify(ds2.daily)).toBe(JSON.stringify(ds.daily))
    expect(ds2.orders.length).toBe(ds.orders.length)
  })

  it('produces a full daily grid for two years', () => {
    expect(ds.daily.length).toBe(730 * REGIONS.length * CHANNELS.length)
    expect(ds.startDay < ds.today).toBe(true)
    const todayRows = ds.daily.filter((r) => r.day === TODAY)
    expect(todayRows.length).toBe(REGIONS.length * CHANNELS.length)
  })

  it('generates internally consistent daily rows', () => {
    for (const r of ds.daily) {
      expect(r.revenue).toBeGreaterThanOrEqual(0)
      expect(r.cogs).toBeLessThanOrEqual(r.revenue + 1e-6)
      expect(r.lateDeliveries).toBeLessThanOrEqual(r.orders)
      expect(r.returns).toBeLessThanOrEqual(r.orders)
      expect(r.orders).toBeGreaterThanOrEqual(0)
    }
  })

  it('creates orders with coherent timelines and statuses', () => {
    expect(ds.orders.length).toBeGreaterThan(800)
    for (const o of ds.orders.slice(0, 200)) {
      expect(o.value).toBeGreaterThan(0)
      expect(o.lines.length).toBeGreaterThan(0)
      expect(REGIONS).toContain(o.region)
      if (o.status === 'delivered' || o.status === 'returned') expect(o.shippedAt).toBeTruthy()
    }
    // statuses are drawn from the allowed set
    const allowed = ['pending', 'picking', 'in_transit', 'delivered', 'delayed', 'returned', 'cancelled']
    for (const o of ds.orders) expect(allowed).toContain(o.status)
  })

  it('creates tickets with SLA math in range', () => {
    expect(ds.tickets.length).toBeGreaterThan(250)
    for (const t of ds.tickets) {
      expect(t.slaHours).toBeGreaterThan(0)
      if (t.resolvedAt) expect(new Date(t.resolvedAt) >= new Date(t.createdAt)).toBe(true)
      if (t.firstResponseAt) expect(new Date(t.firstResponseAt) >= new Date(t.createdAt)).toBe(true)
    }
  })

  it('SKUs have stock entries and demand', () => {
    for (const s of ds.skus) {
      expect(CATEGORIES).toContain(s.category)
      expect(s.dailyDemand).toBeGreaterThan(0)
      expect(s.stock.length).toBeGreaterThan(0)
      for (const st of s.stock) expect(st.qty).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps the growth story plausible: recent revenue beats early revenue', () => {
    const sum = (from: string, to: string) =>
      ds.daily.filter((r) => r.day >= from && r.day <= to).reduce((a, r) => a + r.revenue, 0)
    const early = sum(ds.startDay, ds.startDay.slice(0, 4) + '-12-31')
    const late = sum(TODAY.slice(0, 4) + '-01-01', TODAY)
    expect(late / 5).toBeGreaterThan(early / 6) // 2026 is 5 months in, 2024 had 12
  })

  it('records the heatmap with real counts', () => {
    const total = ds.hourlyByDow.flat().reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(200)
  })
})
