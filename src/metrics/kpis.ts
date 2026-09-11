/**
 * Pure KPI math. Everything here is deterministic, side-effect free and
 * unit-tested — the UI layer only formats what these functions return.
 */
import type { DailyRow } from '../data/model'
import { bucketKey } from '../lib/dates'
import type { Granularity } from '../lib/dates'

/** Fields that SUM when bucketing; the rest are derived/snapshot fields. */
const SUM_FIELDS = [
  'orders',
  'unitsShipped',
  'revenue',
  'cogs',
  'fulfillmentCost',
  'lateDeliveries',
  'returns',
  'newCustomers',
  'ticketsOpened',
  'ticketsResolved',
  'firstResponseMinSum',
  'stockoutEvents',
  'targetRevenue',
] as const

export type SumField = (typeof SUM_FIELDS)[number]

export interface Totals {
  days: number
  orders: number
  unitsShipped: number
  revenue: number
  cogs: number
  fulfillmentCost: number
  lateDeliveries: number
  returns: number
  newCustomers: number
  ticketsOpened: number
  ticketsResolved: number
  firstResponseMinSum: number
  inventoryValueAvg: number
  stockoutEvents: number
  targetRevenue: number
}

export const emptyTotals = (): Totals => ({
  days: 0,
  orders: 0,
  unitsShipped: 0,
  revenue: 0,
  cogs: 0,
  fulfillmentCost: 0,
  lateDeliveries: 0,
  returns: 0,
  newCustomers: 0,
  ticketsOpened: 0,
  ticketsResolved: 0,
  firstResponseMinSum: 0,
  inventoryValueAvg: 0,
  stockoutEvents: 0,
  targetRevenue: 0,
})

export function sumTotals(rows: DailyRow[]): Totals {
  const t = emptyTotals()
  const byDay = new Map<string, number>()
  for (const r of rows) {
    t.orders += r.orders
    t.unitsShipped += r.unitsShipped
    t.revenue += r.revenue
    t.cogs += r.cogs
    t.fulfillmentCost += r.fulfillmentCost
    t.lateDeliveries += r.lateDeliveries
    t.returns += r.returns
    t.newCustomers += r.newCustomers
    t.ticketsOpened += r.ticketsOpened
    t.ticketsResolved += r.ticketsResolved
    t.firstResponseMinSum += r.firstResponseMinSum
    t.stockoutEvents += r.stockoutEvents
    t.targetRevenue += r.targetRevenue
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.inventoryValue)
  }
  t.days = byDay.size
  for (const v of byDay.values()) t.inventoryValueAvg += v
  if (byDay.size > 0) t.inventoryValueAvg /= byDay.size
  return t
}

/** Collapse rows into day/week/month buckets (inventory value averages). */
export function bucketRows(rows: DailyRow[], g: Granularity): DailyRow[] {
  const map = new Map<string, DailyRow>()
  const dayCount = new Map<string, Set<string>>()
  for (const r of rows) {
    const key = bucketKey(r.day, g)
    let acc = map.get(key)
    if (!acc) {
      // start from a zeroed copy so the first row accumulates exactly once
      acc = { ...r, day: key }
      for (const f of SUM_FIELDS) acc[f] = 0
      acc.inventoryValue = 0
      map.set(key, acc)
      dayCount.set(key, new Set())
    }
    dayCount.get(key)!.add(r.day)
    for (const f of SUM_FIELDS) {
      acc[f] += r[f]
    }
    acc.inventoryValue += r.inventoryValue
  }
  const out = [...map.values()]
  for (const b of out) {
    const n = dayCount.get(b.day)?.size ?? 1
    b.inventoryValue /= n
  }
  out.sort((a, b) => (a.day < b.day ? -1 : 1))
  return out
}

export interface DimSlice {
  key: string
  totals: Totals
  prevTotals: Totals
}

export function byDimension(
  rows: DailyRow[],
  dim: 'region' | 'channel',
  cur: DailyRow[],
  prev: DailyRow[],
): DimSlice[] {
  void rows
  const group = (subset: DailyRow[]): Map<string, Totals> => {
    const m = new Map<string, Totals>()
    for (const r of subset) {
      const k = r[dim]
      const cur0 = m.get(k) ?? emptyTotals()
      cur0.orders += r.orders
      cur0.unitsShipped += r.unitsShipped
      cur0.revenue += r.revenue
      cur0.cogs += r.cogs
      cur0.fulfillmentCost += r.fulfillmentCost
      cur0.lateDeliveries += r.lateDeliveries
      cur0.returns += r.returns
      cur0.newCustomers += r.newCustomers
      cur0.ticketsOpened += r.ticketsOpened
      cur0.ticketsResolved += r.ticketsResolved
      cur0.firstResponseMinSum += r.firstResponseMinSum
      cur0.stockoutEvents += r.stockoutEvents
      cur0.targetRevenue += r.targetRevenue
      m.set(k, cur0)
    }
    return m
  }
  const curM = group(cur)
  const prevM = group(prev)
  const keys = new Set([...curM.keys(), ...prevM.keys()])
  const slices = [...keys].map((key) => ({
    key,
    totals: curM.get(key) ?? emptyTotals(),
    prevTotals: prevM.get(key) ?? emptyTotals(),
  }))
  slices.sort((a, b) => b.totals.revenue - a.totals.revenue)
  return slices
}

/* ------------------------------------------------------------------ */
/* KPI definitions                                                     */
/* ------------------------------------------------------------------ */

export interface KpiCtx {
  /** tickets currently open (backlog), point-in-time */
  openBacklog: number
  /** % of windowed tickets that met SLA */
  slaAttainPct: number
  /** count of overdue open tickets */
  overdueOpen: number
}

export type KpiFormat = 'money' | 'int' | 'pct' | 'minutes'
export type KpiStatus = 'ok' | 'watch' | 'risk'

export interface KpiDef {
  id: string
  label: string
  short: string
  tip: string
  format: KpiFormat
  /** how the delta is expressed */
  deltaMode: 'pct' | 'pp'
  /** whether higher is better */
  goodWhenUp: boolean
  compute: (t: Totals, ctx: KpiCtx) => number
  /** sparkline extractor over bucket rows */
  spark: (t: Totals) => number
  status?: (v: number, t: Totals) => KpiStatus | undefined
}

const safeDiv = (a: number, b: number): number => (b === 0 ? 0 : a / b)

export const KPI_DEFS: KpiDef[] = [
  {
    id: 'revenue',
    label: 'Total revenue',
    short: 'Revenue',
    tip: 'Recognized revenue on orders in the selected window.',
    format: 'money',
    deltaMode: 'pct',
    goodWhenUp: true,
    compute: (t) => t.revenue,
    spark: (t) => t.revenue,
  },
  {
    id: 'targetAttain',
    label: 'Plan attainment',
    short: 'vs Plan',
    tip: 'Revenue as a share of the operating plan for the window.',
    format: 'pct',
    deltaMode: 'pp',
    goodWhenUp: true,
    compute: (t) => safeDiv(t.revenue, t.targetRevenue) * 100,
    spark: (t) => safeDiv(t.revenue, t.targetRevenue) * 100,
    status: (v) => (v >= 100 ? 'ok' : v >= 93 ? 'watch' : 'risk'),
  },
  {
    id: 'grossMargin',
    label: 'Gross margin',
    short: 'Margin',
    tip: '(Revenue − COGS) / Revenue across all channels.',
    format: 'pct',
    deltaMode: 'pp',
    goodWhenUp: true,
    compute: (t) => safeDiv(t.revenue - t.cogs, t.revenue) * 100,
    spark: (t) => safeDiv(t.revenue - t.cogs, t.revenue) * 100,
    status: (v) => (v >= 33 ? 'ok' : v >= 29 ? 'watch' : 'risk'),
  },
  {
    id: 'orders',
    label: 'Orders',
    short: 'Orders',
    tip: 'Order count captured in the window.',
    format: 'int',
    deltaMode: 'pct',
    goodWhenUp: true,
    compute: (t) => t.orders,
    spark: (t) => t.orders,
  },
  {
    id: 'aov',
    label: 'Avg order value',
    short: 'AOV',
    tip: 'Revenue divided by order count.',
    format: 'money',
    deltaMode: 'pct',
    goodWhenUp: true,
    compute: (t) => safeDiv(t.revenue, t.orders),
    spark: (t) => safeDiv(t.revenue, t.orders),
  },
  {
    id: 'onTime',
    label: 'On-time delivery',
    short: 'On-time',
    tip: 'Shipments delivered on or before the promise date.',
    format: 'pct',
    deltaMode: 'pp',
    goodWhenUp: true,
    compute: (t) => (1 - safeDiv(t.lateDeliveries, t.orders)) * 100,
    spark: (t) => (1 - safeDiv(t.lateDeliveries, t.orders)) * 100,
    status: (v) => (v >= 94 ? 'ok' : v >= 90 ? 'watch' : 'risk'),
  },
  {
    id: 'returnsPct',
    label: 'Return rate',
    short: 'Returns',
    tip: 'Returned orders as a share of orders placed.',
    format: 'pct',
    deltaMode: 'pp',
    goodWhenUp: false,
    compute: (t) => safeDiv(t.returns, t.orders) * 100,
    spark: (t) => safeDiv(t.returns, t.orders) * 100,
    status: (v) => (v <= 2.6 ? 'ok' : v <= 4 ? 'watch' : 'risk'),
  },
  {
    id: 'fpo',
    label: 'Fulfillment cost / order',
    short: 'Cost/Order',
    tip: 'Pick-pack-ship spend divided by orders. Lower is better.',
    format: 'money',
    deltaMode: 'pct',
    goodWhenUp: false,
    compute: (t) => safeDiv(t.fulfillmentCost, t.orders),
    spark: (t) => safeDiv(t.fulfillmentCost, t.orders),
    status: (v) => (v <= 27 ? 'ok' : v <= 33 ? 'watch' : 'risk'),
  },
  {
    id: 'tickets',
    label: 'Support tickets',
    short: 'Tickets',
    tip: 'Tickets opened in the window. Correlates with delivery friction.',
    format: 'int',
    deltaMode: 'pct',
    goodWhenUp: false,
    compute: (t) => t.ticketsOpened,
    spark: (t) => t.ticketsOpened,
  },
  {
    id: 'firstResp',
    label: 'Avg first response',
    short: 'First reply',
    tip: 'Mean minutes from ticket open to first agent reply.',
    format: 'minutes',
    deltaMode: 'pct',
    goodWhenUp: false,
    compute: (t) => safeDiv(t.firstResponseMinSum, t.ticketsOpened),
    spark: (t) => safeDiv(t.firstResponseMinSum, Math.max(1, t.ticketsOpened)),
    status: (v) => (v <= 45 ? 'ok' : v <= 90 ? 'watch' : 'risk'),
  },
  {
    id: 'sla',
    label: 'SLA attainment',
    short: 'SLA',
    tip: 'Share of windowed tickets resolved within their SLA target.',
    format: 'pct',
    deltaMode: 'pp',
    goodWhenUp: true,
    compute: (_t, ctx) => ctx.slaAttainPct,
    spark: () => 0,
    status: (v) => (v >= 95 ? 'ok' : v >= 90 ? 'watch' : 'risk'),
  },
  {
    id: 'backlog',
    label: 'Open backlog',
    short: 'Backlog',
    tip: 'Tickets currently open, in progress, or waiting on a customer.',
    format: 'int',
    deltaMode: 'pct',
    goodWhenUp: false,
    compute: (_t, ctx) => ctx.openBacklog,
    spark: (t) => t.ticketsOpened - t.ticketsResolved,
    status: (v) => (v <= 18 ? 'ok' : v <= 30 ? 'watch' : 'risk'),
  },
  {
    id: 'newCustomers',
    label: 'New customers',
    short: 'New cust.',
    tip: 'First-time accounts opened in the window.',
    format: 'int',
    deltaMode: 'pct',
    goodWhenUp: true,
    compute: (t) => t.newCustomers,
    spark: (t) => t.newCustomers,
  },
  {
    id: 'inventoryValue',
    label: 'Inventory value',
    short: 'Inventory',
    tip: 'Average on-hand inventory value across the window.',
    format: 'money',
    deltaMode: 'pct',
    goodWhenUp: true,
    compute: (t) => t.inventoryValueAvg,
    spark: (t) => t.inventoryValueAvg,
  },
  {
    id: 'stockouts',
    label: 'Stockout events',
    short: 'Stockouts',
    tip: 'Line items that could not ship on time because stock was short.',
    format: 'int',
    deltaMode: 'pct',
    goodWhenUp: false,
    compute: (t) => t.stockoutEvents,
    spark: (t) => t.stockoutEvents,
    status: (v) => (v === 0 ? 'ok' : 'watch'),
  },
]

export const KPI_BY_ID = new Map(KPI_DEFS.map((d) => [d.id, d]))

export interface Kpi {
  def: KpiDef
  value: number
  prevValue: number
  /** pct change for deltaMode 'pct', pp change for 'pp'; null if no baseline */
  delta: number | null
  status?: KpiStatus
  spark: number[]
}

export function computeKpi(def: KpiDef, cur: Totals, prev: Totals, ctx: KpiCtx, prevCtx: KpiCtx, sparkBuckets: DailyRow[]): Kpi {
  const value = def.compute(cur, ctx)
  const prevValue = def.compute(prev, prevCtx)
  let delta: number | null = null
  if (def.deltaMode === 'pp') {
    delta = value - prevValue
  } else if (prevValue !== 0) {
    delta = ((value - prevValue) / Math.abs(prevValue)) * 100
  } else if (value !== 0) {
    delta = null
  } else {
    delta = 0
  }
  const spark = sparkBuckets.length
    ? sparkBuckets.map((r) => def.spark(sumTotals([r])))
    : []
  return { def, value, prevValue, delta, status: def.status?.(value, cur), spark }
}

/** pct change, null-safe; treats a zero baseline as "no delta". */
export function pctDelta(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null
  if (prev === 0) return cur === 0 ? 0 : null
  return ((cur - prev) / Math.abs(prev)) * 100
}

/* ------------------------------------------------------------------ */
/* series helpers                                                      */
/* ------------------------------------------------------------------ */

export interface TrendPoint {
  key: string
  label: string
  revenue: number
  prevRevenue: number
  orders: number
  cost: number
  grossMarginPct: number
  onTimePct: number
  tickets: number
}

export function buildTrend(
  curBucketed: DailyRow[],
  prevBucketed: DailyRow[],
  labels: (key: string) => string,
): TrendPoint[] {
  // Align by position: bucket N of the current window ↔ bucket N of the prior window.
  const prevTotals = prevBucketed.map((r) => sumTotals([r]))
  return curBucketed.map((r, i) => {
    const t = sumTotals([r])
    const p = prevTotals[i]
    return {
      key: r.day,
      label: labels(r.day),
      revenue: t.revenue,
      prevRevenue: p?.revenue ?? 0,
      orders: t.orders,
      cost: t.cogs + t.fulfillmentCost,
      grossMarginPct: safeDiv(t.revenue - t.cogs, t.revenue) * 100,
      onTimePct: (1 - safeDiv(t.lateDeliveries, t.orders)) * 100,
      tickets: t.ticketsOpened,
    }
  })
}

export interface StockoutDay {
  day: string
  events: number
}

export function stockoutSeries(rows: DailyRow[]): StockoutDay[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.day, (m.get(r.day) ?? 0) + r.stockoutEvents)
  return [...m.entries()]
    .map(([day, events]) => ({ day, events }))
    .sort((a, b) => (a.day < b.day ? -1 : 1))
}
