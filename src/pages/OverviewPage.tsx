import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Bell } from 'lucide-react'
import { useOps, filterDaily } from '../data/selectors'
import { useDataset, useRangeInfo } from '../data/selectors'
import { useStore } from '../state/store'
import { inRange } from '../lib/dates'
import { sumTotals } from '../metrics/kpis'
import { StatCard } from '../components/ui/StatCard'
import { Card, Badge } from '../components/ui/primitives'
import { TrendChart } from '../components/charts/TrendChart'
import { ChannelDonut } from '../components/charts/ChannelDonut'
import { RegionBars } from '../components/charts/RegionBars'
import { Funnel } from '../components/charts/Funnel'
import { Heatmap } from '../components/ui/Heatmap'
import { InsightsList } from '../components/shared/InsightsList'
import { AlertFeed } from '../components/shared/AlertFeed'
import { fmtDay, fmtInt, fmtMoney, fmtPct } from '../lib/format'
import { safeDiv } from '../lib/util'

const OVERVIEW_KPIS = ['revenue', 'targetAttain', 'grossMargin', 'orders', 'onTime', 'fpo', 'backlog', 'sla'] as const

export function OverviewPage() {
  const ops = useOps()
  const ds = useDataset()
  const { range, days } = useRangeInfo()
  const compare = useStore((s) => s.compare)

  // Two-year revenue momentum for the header banner
  const yoy = useMemo(() => {
    const aYearAgo = { start: shiftYear(range.start), end: shiftYear(range.end) }
    const scoped = filterDaily(ds.daily, 'all', 'all').filter((r) => inRange(r.day, aYearAgo))
    const t = sumTotals(scoped)
    return ops.cur.revenue > 0 && t.revenue > 0 ? ((ops.cur.revenue - t.revenue) / t.revenue) * 100 : null
  }, [ds.daily, range, ops.cur.revenue])

  const donutData = useMemo(
    () =>
      ops.channelSlices
        .map((s) => ({
          name: s.key,
          value: s.totals.revenue,
          orders: s.totals.orders,
          prevValue: s.prevTotals.revenue,
        }))
        .sort((a, b) => b.value - a.value),
    [ops.channelSlices],
  )

  const regionData = useMemo(
    () =>
      ops.regionSlices.map((s) => ({
        region: s.key,
        onTimePct: (1 - safeDiv(s.totals.lateDeliveries, s.totals.orders)) * 100,
        prevOnTimePct: s.prevTotals.orders ? (1 - safeDiv(s.prevTotals.lateDeliveries, s.prevTotals.orders)) * 100 : 0,
        late: s.totals.lateDeliveries,
        orders: s.totals.orders,
      })),
    [ops.regionSlices],
  )

  const funnelStages = useMemo(() => {
    const o = ops.scopedOrders
    const placed = o.length
    const fulfilled = o.filter((x) => x.status !== 'cancelled' && x.status !== 'pending').length
    const shipped = o.filter((x) => ['in_transit', 'delivered', 'delayed', 'returned'].includes(x.status)).length
    const delivered = o.filter((x) => ['delivered', 'returned'].includes(x.status)).length
    const onTime = o.filter((x) => x.status === 'delivered' && (!x.deliveredAt || x.deliveredAt.slice(0, 10) <= x.promiseDate)).length
    return [
      { label: 'Captured', value: placed, note: 'orders in window', tone: 'sky' as const },
      { label: 'Released to floor', value: fulfilled, note: 'not cancelled/pending', tone: 'emerald' as const },
      { label: 'Shipped', value: shipped, tone: 'emerald' as const },
      { label: 'Delivered', value: delivered, tone: 'emerald' as const },
      { label: 'On time', value: onTime, note: 'promise-date hit', tone: 'emerald' as const },
    ]
  }, [ops.scopedOrders])

  const banner = useMemo(() => {
    const k = ops.kpis
    const bits: string[] = []
    bits.push(`${fmtMoney(ops.cur.revenue)} revenue (${days}d)`)
    if (k.targetAttain) bits.push(`${fmtPct(k.targetAttain.value, 0)} of plan`)
    if (yoy !== null) bits.push(`${yoy >= 0 ? '+' : ''}${yoy.toFixed(0)}% vs same period last year`)
    bits.push(`${fmtInt(ops.cur.orders)} orders`)
    return bits.join(' · ')
  }, [ops, days, yoy])

  return (
    <div className="space-y-4">
      {/* Executive banner */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-4 py-3 text-white shadow-md">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-tight">
            Ops brief — {fmtDay(range.start)} to {fmtDay(range.end)}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-emerald-50/90">{banner}</p>
        </div>
        <div className="flex items-center gap-2">
          {ops.overdueOpen > 0 ? (
            <Link
              to="/support"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur transition-colors hover:bg-white/25"
            >
              <Bell className="h-3.5 w-3.5" /> {ops.overdueOpen} past SLA
            </Link>
          ) : (
            <Badge tone="emerald" className="border-0 bg-white/15 text-white ring-white/20">
              All tickets in SLA
            </Badge>
          )}
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm transition-transform hover:-translate-y-px"
          >
            Build report <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {OVERVIEW_KPIS.map((id) => (
          <StatCard key={id} kpi={ops.kpis[id]} compareLabel={compare ? `vs prev ${days}d` : 'current period'} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card
          className="col-span-12 xl:col-span-8"
          title="Revenue, cost & volume"
          subtitle={`Bucketed by ${ops.bucket}; hover any point for the margin behind it`}
          info="Revenue area vs blended cost line. The dashed line is the period average."
          actions={
            <div className="flex items-center gap-3 text-[10.5px] font-medium">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><span className="h-2 w-2 rounded-sm bg-emerald-600" /> Revenue</span>
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><span className="h-2 w-2 rounded-sm bg-sky-500" /> Cost</span>
              {compare && <span className="hidden items-center gap-1.5 text-slate-500 sm:flex dark:text-slate-400"><span className="h-0.5 w-3 border-t-2 border-dashed border-slate-400" /> Prev period</span>}
            </div>
          }
        >
          <TrendChart data={ops.trend} showPrev={compare} metric="revenue" planLine={ops.cur.targetRevenue / Math.max(1, ops.trend.length)} />
        </Card>

        <Card
          className="col-span-12 xl:col-span-4"
          title={
            <span className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-600" /> What needs attention
            </span>
          }
          subtitle={`Auto-generated from ${days}d of data`}
        >
          <InsightsList insights={ops.insights} dense />
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Revenue by channel" subtitle="Donut = channel mix, with momentum vs prior period">
          <ChannelDonut data={donutData} />
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="On-time delivery by region" info="Share of orders delivered on or before the promise date. Target line at 94%." subtitle="Bars below the line = regions to chase">
          <RegionBars data={regionData} />
        </Card>

        <Card className="col-span-12 xl:col-span-4" title="Channel scorecard" subtitle="Revenue, mix and margin by sales motion">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] tracking-wide text-slate-400 uppercase">
                <th className="pb-2 font-semibold">Channel</th>
                <th className="pb-2 text-right font-semibold">Revenue</th>
                <th className="pb-2 text-right font-semibold">Δ</th>
                <th className="pb-2 text-right font-semibold">Margin</th>
              </tr>
            </thead>
            <tbody>
              {ops.channelSlices.map((s) => {
                const delta = s.prevTotals.revenue ? ((s.totals.revenue - s.prevTotals.revenue) / s.prevTotals.revenue) * 100 : null
                const margin = safeDiv(s.totals.revenue - s.totals.cogs, s.totals.revenue) * 100
                return (
                  <tr key={s.key} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 font-medium">{s.key}</td>
                    <td className="tnum py-2 text-right font-semibold">{fmtMoney(s.totals.revenue)}</td>
                    <td className={`tnum py-2 text-right font-medium ${delta === null ? 'muted' : delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}
                    </td>
                    <td className="tnum muted py-2 text-right">{fmtPct(margin, 1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Fulfillment funnel" info="Order-stage conversion across the sampled order detail records for this window." subtitle="Where orders fall out before the customer door">
          <Funnel stages={funnelStages} />
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Support load by hour" subtitle="Tickets opened — weekday × hour (trailing 60d)">
          <Heatmap grid={ds.hourlyByDow} />
        </Card>

        <Card className="col-span-12 xl:col-span-3" title="Activity">
          <AlertFeed />
        </Card>
      </div>
    </div>
  )
}

function shiftYear(iso: string): string {
  const d = new Date(iso)
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}
