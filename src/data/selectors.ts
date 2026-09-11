/**
 * Hooks that compose the store, the dataset and the pure metric math into
 * everything the pages need. All heavy lifting happens in useMemo'd calls to
 * pure functions in ../metrics — this module is wiring only.
 */
import { useMemo } from 'react'
import { getDataset } from './dataset'
import type { Channel, DailyRow, OrderRecord, Region, SkuRecord, TicketRecord } from './model'
import { useStore } from '../state/store'
import {
  bucketRows,
  byDimension,
  computeKpi,
  KPI_DEFS,
  sumTotals,
  buildTrend,
  type Kpi,
  type Totals,
} from '../metrics/kpis'
import { generateInsights, type Insight, type InsightCtx } from '../metrics/insights'
import { bucketLabel, granularityFor, inRange, previousRange, resolveRange, type DayRange, type Granularity } from '../lib/dates'

export interface RangeInfo {
  range: DayRange
  prevRange: DayRange
  days: number
  bucket: Granularity
}

export function useDataset() {
  return getDataset()
}

export function useRangeInfo(): RangeInfo {
  const ds = getDataset()
  const preset = useStore((s) => s.preset)
  const customRange = useStore((s) => s.customRange)
  return useMemo(() => {
    const range = resolveRange(preset, customRange, ds.startDay, ds.today)
    const days =
      (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000 + 1
    return { range, prevRange: previousRange(range), days: Math.round(days), bucket: granularityFor(Math.round(days)) }
  }, [preset, customRange, ds.startDay, ds.today])
}

/** Apply the live simulation overlay to today's rows. */
export function applyLivePatch(rows: DailyRow[], live: boolean, patch: { day: string; region: string; channel: string; orders: number; revenue: number; cogs: number; ticketsOpened: number; ticketsResolved: number }[], today: string): DailyRow[] {
  if (!live || patch.length === 0) return rows
  const byKey = new Map<string, { orders: number; revenue: number; cogs: number; ticketsOpened: number; ticketsResolved: number }>()
  for (const p of patch) {
    if (p.day !== today) continue
    const k = `${p.region}|${p.channel}`
    const acc = byKey.get(k) ?? { orders: 0, revenue: 0, cogs: 0, ticketsOpened: 0, ticketsResolved: 0 }
    acc.orders += p.orders
    acc.revenue += p.revenue
    acc.cogs += p.cogs
    acc.ticketsOpened += p.ticketsOpened
    acc.ticketsResolved += p.ticketsResolved
    byKey.set(k, acc)
  }
  if (byKey.size === 0) return rows
  return rows.map((r) => {
    if (r.day !== today) return r
    const p = byKey.get(`${r.region}|${r.channel}`)
    if (!p) return r
    return {
      ...r,
      orders: r.orders + p.orders,
      revenue: r.revenue + p.revenue,
      cogs: r.cogs + p.cogs,
      ticketsOpened: r.ticketsOpened + p.ticketsOpened,
      ticketsResolved: r.ticketsResolved + p.ticketsResolved,
    }
  })
}

export function filterDaily(rows: DailyRow[], region: Region | 'all', channel: Channel | 'all'): DailyRow[] {
  if (region === 'all' && channel === 'all') return rows
  return rows.filter((r) => (region === 'all' || r.region === region) && (channel === 'all' || r.channel === channel))
}

export interface OpsBundle {
  today: string
  range: DayRange
  prevRange: DayRange
  days: number
  bucket: Granularity
  cur: Totals
  prev: Totals
  kpis: Record<string, Kpi>
  kpiList: Kpi[]
  trend: ReturnType<typeof buildTrend>
  channelSlices: ReturnType<typeof byDimension>
  regionSlices: ReturnType<typeof byDimension>
  insights: Insight[]
  scopedOrders: OrderRecord[]
  windowedTickets: TicketRecord[]
  prevWindowedTickets: TicketRecord[]
  openBacklog: number
  overdueOpen: number
  slaAttainPct: number
  stock: StockSummary
  lateOrderDrivers: { reason: string; count: number }[]
  stockoutTrend: { label: string; value: number }[]
}

export interface SkuComputed extends SkuRecord {
  totalStock: number
  stockValue: number
  daysOfCover: number
  status: 'out_of_stock' | 'critical' | 'low' | 'healthy'
  suggestedPo: number
}

export interface StockSummary {
  items: SkuComputed[]
  inventoryValue: number
  outOfStock: SkuComputed[]
  critical: SkuComputed[]
  low: SkuComputed[]
  avgCoverDays: number
  atRiskWeeklyDemand: number
}

export function computeStock(skus: SkuRecord[]): StockSummary {
  const items: SkuComputed[] = skus.map((s) => {
    const totalStock = s.stock.reduce((a, b) => a + b.qty, 0)
    const daysOfCover = totalStock / Math.max(0.2, s.dailyDemand)
    const status: SkuComputed['status'] =
      totalStock <= 0 ? 'out_of_stock' : daysOfCover < s.leadTimeDays ? 'critical' : totalStock < s.reorderPoint * 1.6 ? 'low' : 'healthy'
    const suggestedPo = Math.max(0, Math.ceil(s.dailyDemand * (s.leadTimeDays + 7) - totalStock))
    return { ...s, totalStock, stockValue: totalStock * s.cost, daysOfCover, status, suggestedPo }
  })
  const outOfStock = items.filter((i) => i.status === 'out_of_stock')
  const critical = items.filter((i) => i.status === 'critical')
  const low = items.filter((i) => i.status === 'low')
  const avgCoverDays = items.reduce((a, b) => a + b.daysOfCover, 0) / Math.max(1, items.length)
  const atRiskWeeklyDemand = [...outOfStock, ...critical].reduce((a, b) => a + b.dailyDemand * 7 * b.price, 0)
  return {
    items,
    inventoryValue: items.reduce((a, b) => a + b.stockValue, 0),
    outOfStock,
    critical,
    low,
    avgCoverDays,
    atRiskWeeklyDemand,
  }
}

export function ticketStats(tickets: TicketRecord[], nowIso: string) {
  const open = tickets.filter((t) => t.status !== 'resolved')
  const overdueOpen = open.filter((t) => new Date(t.createdAt).getTime() + t.slaHours * 3_600_000 < new Date(nowIso).getTime())
  const resolved = tickets.filter((t) => t.resolvedAt)
  const withinSla = resolved.filter((t) => (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3_600_000 <= t.slaHours)
  const slaAttainPct = resolved.length ? (withinSla.length / resolved.length) * 100 : 100
  return { open, overdueOpen: overdueOpen.length, slaAttainPct, resolvedCount: resolved.length }
}

/** The main data hook used by every page. */
export function useOps(): OpsBundle {
  const ds = getDataset()
  const { range, prevRange, days, bucket } = useRangeInfo()
  const region = useStore((s) => s.region)
  const channel = useStore((s) => s.channel)
  const live = useStore((s) => s.live)
  const livePatch = useStore((s) => s.livePatch)

  const scopedDaily = useMemo(
    () => filterDaily(ds.daily, region, channel),
    [ds.daily, region, channel],
  )
  const daily = useMemo(
    () => applyLivePatch(scopedDaily, live, livePatch, ds.today),
    [scopedDaily, live, livePatch, ds.today],
  )

  const curRows = useMemo(() => daily.filter((r) => inRange(r.day, range)), [daily, range])
  const prevRows = useMemo(() => daily.filter((r) => inRange(r.day, prevRange)), [daily, prevRange])

  const cur = useMemo(() => sumTotals(curRows), [curRows])
  const prev = useMemo(() => sumTotals(prevRows), [prevRows])

  const curBuckets = useMemo(() => bucketRows(curRows, bucket), [curRows, bucket])
  const prevBuckets = useMemo(() => bucketRows(prevRows, bucket), [prevRows, bucket])

  const windowedTickets = useMemo(() => {
    let t = ds.tickets.filter((x) => x.createdAt.slice(0, 10) >= range.start && x.createdAt.slice(0, 10) <= range.end)
    if (region !== 'all') t = t.filter((x) => x.region === region)
    return t
  }, [ds.tickets, range, region])
  const prevWindowedTickets = useMemo(() => {
    let t = ds.tickets.filter((x) => x.createdAt.slice(0, 10) >= prevRange.start && x.createdAt.slice(0, 10) <= prevRange.end)
    if (region !== 'all') t = t.filter((x) => x.region === region)
    return t
  }, [ds.tickets, prevRange, region])

  const stock = useMemo(() => computeStock(ds.skus), [ds.skus])

  const tStats = useMemo(() => ticketStats(windowedTickets, ds.generatedAt), [windowedTickets, ds.generatedAt])
  const prevTStats = useMemo(() => ticketStats(prevWindowedTickets, prevRange.end), [prevWindowedTickets, prevRange.end])

  const scopedOrders = useMemo(() => {
    let o = ds.orders.filter((x) => inRange(x.day, range))
    if (region !== 'all') o = o.filter((x) => x.region === region)
    if (channel !== 'all') o = o.filter((x) => x.channel === channel)
    return o
  }, [ds.orders, range, region, channel])

  const lateOrderDrivers = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of ds.orders) {
      if (o.status === 'delayed' && o.delayReason) m.set(o.delayReason, (m.get(o.delayReason) ?? 0) + 1)
    }
    return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
  }, [ds.orders])

  const channelSlices = useMemo(() => {
    const ch = byDimension('channel', curRows, prevRows)
    if (channel === 'all') return ch
    return ch.filter((s) => s.key === channel)
  }, [curRows, prevRows, channel])

  const regionSlices = useMemo(() => {
    const rg = byDimension('region', curRows, prevRows)
    return region === 'all' ? rg : rg.filter((s) => s.key === region)
  }, [curRows, prevRows, region])

  const kpiCtx = useMemo(
    () => ({
      openBacklog: tStats.open.length,
      slaAttainPct: tStats.slaAttainPct,
      overdueOpen: tStats.overdueOpen,
    }),
    [tStats],
  )
  const prevKpiCtx = useMemo(
    () => ({
      openBacklog: prevTStats.open.length,
      slaAttainPct: prevTStats.slaAttainPct,
      overdueOpen: prevTStats.overdueOpen,
    }),
    [prevTStats],
  )

  const kpis = useMemo(() => {
    const out: Record<string, Kpi> = {}
    for (const def of KPI_DEFS) {
      out[def.id] = computeKpi(def, cur, prev, kpiCtx, prevKpiCtx, curBuckets)
    }
    return out
  }, [cur, prev, kpiCtx, prevKpiCtx, curBuckets])

  const insights = useMemo(() => {
    const totalLtv = ds.customers.reduce((a, b) => a + b.lifetimeValue, 0)
    const top10 = [...ds.customers].sort((a, b) => b.lifetimeValue - a.lifetimeValue).slice(0, 10)
    const ctx: InsightCtx = {
      days,
      cur,
      prev,
      byRegion: regionSlices,
      byChannel: channelSlices,
      onTimePct: 100 - (cur.orders ? (cur.lateDeliveries / cur.orders) * 100 : 0),
      prevOnTimePct: 100 - (prev.orders ? (prev.lateDeliveries / prev.orders) * 100 : 0),
      slaAttainPct: tStats.slaAttainPct,
      openBacklog: tStats.open.length,
      overdueOpen: tStats.overdueOpen,
      outOfStock: stock.outOfStock.length,
      belowLeadTime: stock.critical.length,
      topCustomerSharePct: totalLtv ? (top10.reduce((a, b) => a + b.lifetimeValue, 0) / totalLtv) * 100 : 0,
      lateOrderDrivers,
    }
    return generateInsights(ctx)
  }, [days, cur, prev, regionSlices, channelSlices, tStats, stock, ds.customers, lateOrderDrivers])

  const trend = useMemo(() => buildTrend(curBuckets, prevBuckets, (k) => bucketLabel(k, bucket)), [curBuckets, prevBuckets, bucket])

  const stockoutTrend = useMemo(
    () => curBuckets.map((r) => ({ label: bucketLabel(r.day, bucket), value: r.stockoutEvents })),
    [curBuckets, bucket],
  )

  return {
    today: ds.today,
    range,
    prevRange,
    days,
    bucket,
    cur,
    prev,
    kpis,
    kpiList: KPI_DEFS.map((d) => kpis[d.id]).filter(Boolean),
    trend,
    channelSlices,
    regionSlices,
    insights,
    scopedOrders,
    windowedTickets,
    prevWindowedTickets,
    openBacklog: tStats.open.length,
    overdueOpen: tStats.overdueOpen,
    slaAttainPct: tStats.slaAttainPct,
    stock,
    lateOrderDrivers,
    stockoutTrend,
  }
}

