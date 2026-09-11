/**
 * Rule-based insight writer: turns the numbers into short English sentences
 * so a manager gets "the answer" without interrogating the charts.
 */
import { fmtInt, fmtMoney, fmtPct } from '../lib/format'
import type { DimSlice, Totals } from './kpis'
import { pctDelta } from './kpis'

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info'

export interface Insight {
  id: string
  severity: InsightSeverity
  title: string
  body: string
  link?: string
}

export interface StockFlag {
  label: string
  count: number
}

export interface InsightCtx {
  days: number
  cur: Totals
  prev: Totals
  byRegion: DimSlice[]
  byChannel: DimSlice[]
  onTimePct: number
  prevOnTimePct: number
  slaAttainPct: number
  openBacklog: number
  overdueOpen: number
  outOfStock: number
  belowLeadTime: number
  topCustomerSharePct: number
  lateOrderDrivers: { reason: string; count: number }[]
}

const safeDiv = (a: number, b: number): number => (b === 0 ? 0 : a / b)

export function generateInsights(ctx: InsightCtx): Insight[] {
  const out: Insight[] = []
  const win = `past ${ctx.days} days`
  const revDelta = pctDelta(ctx.cur.revenue, ctx.prev.revenue)
  const ordDelta = pctDelta(ctx.cur.orders, ctx.prev.orders)

  // 1. Revenue direction, attributed to the biggest regional mover.
  if (revDelta !== null && Math.abs(revDelta) >= 4 && ctx.prev.revenue > 0) {
    const movers = ctx.byRegion
      .filter((s) => s.prevTotals.revenue > 0)
      .map((s) => ({ s, d: pctDelta(s.totals.revenue, s.prevTotals.revenue) }))
      .filter((m) => m.d !== null)
      .sort((a, b) => Math.abs(b.d!) - Math.abs(a.d!))
    const lead = movers[0]
    const dir = revDelta >= 0 ? 'up' : 'down'
    const verb = revDelta >= 0 ? 'led by' : 'dragged by'
    out.push({
      id: 'revenue-move',
      severity: revDelta >= 0 ? 'positive' : 'warning',
      title: `Revenue is ${dir} ${fmtPct(Math.abs(revDelta))} ${win}`,
      body:
        `${fmtMoney(ctx.cur.revenue)} vs ${fmtMoney(ctx.prev.revenue)} prior period` +
        (lead?.d ? `, ${verb} ${lead.s.key} at ${lead.d >= 0 ? '+' : ''}${fmtPct(lead.d)}.` : '.') +
        ` Orders ${ordDelta !== null ? `${ordDelta >= 0 ? '+' : ''}${fmtPct(ordDelta)}` : 'n/a'}.`,
      link: '/',
    })
  }

  // 2. Plan attainment
  const plan = ctx.cur.targetRevenue
  const attain = safeDiv(ctx.cur.revenue, plan) * 100
  if (plan > 0 && (attain < 93 || attain >= 100)) {
    out.push({
      id: 'attainment',
      severity: attain >= 100 ? 'positive' : 'warning',
      title: attain >= 100 ? `Ahead of plan — ${fmtPct(attain)} attainment` : `Behind plan at ${fmtPct(attain)}`,
      body:
        attain >= 100
          ? `Revenue is running ${fmtMoney(ctx.cur.revenue - plan)} above the operating plan for this period.`
          : `Closing the gap needs ${fmtMoney(plan - ctx.cur.revenue)} more; at the current run-rate you land ${fmtPct(attain)} of plan.`,
      link: '/reports',
    })
  }

  // 3. Delivery health
  if (ctx.onTimePct < 90 || ctx.onTimePct - ctx.prevOnTimePct <= -1.5) {
    const worst = [...ctx.byRegion].sort((a, b) => safeDiv(b.totals.lateDeliveries, b.totals.orders) - safeDiv(a.totals.lateDeliveries, a.totals.orders))[0]
    const reason = ctx.lateOrderDrivers[0]
    out.push({
      id: 'ontime',
      severity: ctx.onTimePct < 87 ? 'critical' : 'warning',
      title: `On-time delivery at ${fmtPct(ctx.onTimePct)}`,
      body:
        `${fmtInt(ctx.cur.lateDeliveries)} late shipments in the window` +
        (worst ? ` — ${worst.key} is the laggard at ${fmtPct(100 - safeDiv(worst.totals.lateDeliveries, worst.totals.orders) * 100)} on-time` : '') +
        (reason ? `. Top cause today: ${reason.reason} (${reason.count} orders).` : '.'),
      link: '/orders',
    })
  }

  // 4. Fulfillment economics
  const fpo = safeDiv(ctx.cur.fulfillmentCost, ctx.cur.orders)
  const prevFpo = safeDiv(ctx.prev.fulfillmentCost, ctx.prev.orders)
  const fpoDelta = pctDelta(fpo, prevFpo)
  if (fpoDelta !== null && fpoDelta >= 6) {
    out.push({
      id: 'fpo',
      severity: 'warning',
      title: `Fulfillment cost per order up ${fmtPct(fpoDelta)}`,
      body: `Now ${fmtMoney(fpo, false)} per order vs ${fmtMoney(prevFpo, false)} prior. Roughly ${fmtMoney((fpo - prevFpo) * ctx.cur.orders)} of extra cost this period.`,
      link: '/',
    })
  }

  // 5. Support / SLA
  if (ctx.overdueOpen > 0 || ctx.slaAttainPct < 92) {
    out.push({
      id: 'sla',
      severity: ctx.slaAttainPct < 85 || ctx.overdueOpen >= 10 ? 'critical' : 'warning',
      title: `Support pressure: ${ctx.overdueOpen} tickets past SLA`,
      body: `Backlog is ${ctx.openBacklog} tickets and SLA attainment sits at ${fmtPct(ctx.slaAttainPct)}. Triage critical and high priorities first.`,
      link: '/support',
    })
  }

  // 6. Inventory risk
  if (ctx.outOfStock > 0 || ctx.belowLeadTime >= 3) {
    out.push({
      id: 'stock',
      severity: ctx.outOfStock > 0 ? 'critical' : 'warning',
      title:
        ctx.outOfStock > 0
          ? `${ctx.outOfStock} SKUs out of stock${ctx.belowLeadTime ? `, ${ctx.belowLeadTime} more under lead time` : ''}`
          : `${ctx.belowLeadTime} SKUs below replenishment lead time`,
      body: `Demand at risk is roughly ${fmtMoney(estimateDemandAtRisk(ctx))} per week. Suppliers with the longest lead times should be triggered today.`,
      link: '/inventory',
    })
  }

  // 7. Concentration
  if (ctx.topCustomerSharePct >= 30) {
    out.push({
      id: 'concentration',
      severity: 'info',
      title: `Revenue concentration: top 10 accounts = ${fmtPct(ctx.topCustomerSharePct)}`,
      body: 'A high share of revenue sits with a handful of accounts. Worth a retention check-in with the at-risk ones.',
      link: '/customers',
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'all-good',
      severity: 'positive',
      title: 'Operations are steady',
      body: `No thresholds tripped this period — revenue ${fmtMoney(ctx.cur.revenue)}, on-time ${fmtPct(ctx.onTimePct)}, backlog ${ctx.openBacklog}. Keep it up.`,
    })
  }

  const rank: Record<InsightSeverity, number> = { critical: 0, warning: 1, positive: 2, info: 3 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6)
}

function estimateDemandAtRisk(ctx: InsightCtx): number {
  void ctx
  // Conservative placeholder: below-lead-time SKUs × avg weekly demand $
  return ctx.belowLeadTime * 3200 + ctx.outOfStock * 6100
}
