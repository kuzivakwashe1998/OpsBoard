import { useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Download, Search, ShieldAlert } from 'lucide-react'
import type { CustomerRecord } from '../data/model'
import { SEGMENTS } from '../data/model'
import { useOps, useDataset } from '../data/selectors'
import { useFocusParam } from '../lib/useFocusParam'
import { DataTable } from '../components/ui/DataTable'
import { Badge, Button, Card, ProgressBar, Select, TextInput } from '../components/ui/primitives'
import { Leaderboard } from '../components/charts/RegionBars'
import { fmtDay, fmtInt, fmtMoney, fmtPct } from '../lib/format'
import { downloadText, toCSV } from '../lib/csv'
import { useStore } from '../state/store'
import { cn } from '../lib/cn'
import { safeDiv } from '../lib/util'

interface CustomerEnriched extends CustomerRecord {
  windowRevenue: number
  windowOrders: number
}

const col = createColumnHelper<CustomerEnriched>()

export function CustomersPage() {
  const ds = useDataset()
  const ops = useOps()
  const pushToast = useStore((s) => s.pushToast)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<string>('all')
  const [atRiskOnly, setAtRiskOnly] = useState(false)
  const [focusId, clearFocus] = useFocusParam()

  useEffect(() => {
    if (!focusId) return
    const c = customers.find((x) => x.id === focusId)
    if (c) setSearch(c.name)
    clearFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId])

  const customers = ds.customers
  const ordersByCustomer = useMemo(() => {
    const m = new Map<string, { revenue: number; orders: number }>()
    for (const o of ds.orders) {
      if (o.status === 'cancelled') continue
      const cur = m.get(o.customerId) ?? { revenue: 0, orders: 0 }
      cur.revenue += o.value
      cur.orders += 1
      m.set(o.customerId, cur)
    }
    return m
  }, [ds.orders])

  const enriched = useMemo(() => {
    const rows = customers.map((c) => ({ ...c, windowRevenue: ordersByCustomer.get(c.id)?.revenue ?? 0, windowOrders: ordersByCustomer.get(c.id)?.orders ?? 0 }))
    let out = rows
    if (segment !== 'all') out = out.filter((c) => c.segment === segment)
    if (atRiskOnly) out = out.filter((c) => c.status === 'at_risk' || c.status === 'dormant')
    if (search.trim()) {
      const v = search.trim().toLowerCase()
      out = out.filter((c) => c.name.toLowerCase().includes(v) || c.region.toLowerCase().includes(v))
    }
    return out.sort((a, b) => b.windowRevenue - a.windowRevenue || b.lifetimeValue - a.lifetimeValue)
  }, [customers, ordersByCustomer, segment, atRiskOnly, search])

  const totalWindowRev = Math.max(1, ops.cur.revenue)
  const top10Share = useMemo(() => {
    const sortedAll = [...enriched].sort((a, b) => b.windowRevenue - a.windowRevenue).slice(0, 10)
    return safeDiv(sortedAll.reduce((a, c) => a + c.windowRevenue, 0), totalWindowRev) * 100
  }, [enriched, totalWindowRev])

  const atRiskRevenue = useMemo(() => customers.filter((c) => c.status === 'at_risk' || c.status === 'dormant').reduce((a, c) => a + c.lifetimeValue, 0), [customers])

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Account',
        cell: (c) => (
          <span className="flex max-w-52 items-center gap-2">
            {c.row.original.churnRisk === 'high' && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-label="High churn risk" />}
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.getValue()}</span>
              <span className="muted block text-[10px]">{c.row.original.region} · since {fmtDay(c.row.original.since)}</span>
            </span>
          </span>
        ),
        meta: { exportValue: (r: CustomerRecord) => r.name },
      }),
      col.accessor('segment', {
        header: 'Segment',
        cell: (c) => <Badge tone={c.getValue() === 'Enterprise' ? 'violet' : c.getValue() === 'Mid-Market' ? 'sky' : 'neutral'}>{c.getValue()}</Badge>,
        meta: { exportValue: (r: CustomerRecord) => r.segment },
      }),
      col.display({
        id: 'window',
        header: 'Window rev.',
        cell: (c) => <span className="font-semibold">{fmtMoney(c.row.original.windowRevenue)}</span>,
        meta: { align: 'right', exportValue: (r: CustomerEnriched) => Math.round(r.windowRevenue) },
      }),
      col.accessor('lifetimeValue', {
        header: 'Lifetime',
        cell: (c) => <span>{fmtMoney(c.getValue())}</span>,
        meta: { align: 'right', exportValue: (r: CustomerRecord) => r.lifetimeValue },
      }),
      col.accessor('aov', {
        header: 'AOV',
        cell: (c) => <span className="muted">{fmtMoney(c.getValue(), false)}</span>,
        meta: { align: 'right', exportValue: (r: CustomerRecord) => r.aov },
      }),
      col.accessor('orders', {
        header: 'Orders',
        cell: (c) => fmtInt(c.getValue()),
        meta: { align: 'right', exportValue: (r: CustomerRecord) => r.orders },
      }),
      col.accessor('healthScore', {
        header: 'Health',
        cell: (c) => {
          const v = c.getValue()
          return (
            <span className="flex w-32 items-center gap-2">
              <ProgressBar value={v} tone={v >= 70 ? 'emerald' : v >= 52 ? 'amber' : 'rose'} className="flex-1" />
              <span className={cn('tnum w-6 text-right text-[11px] font-semibold', v < 52 && 'text-rose-600 dark:text-rose-400')}>{v}</span>
            </span>
          )
        },
        meta: { align: 'right', exportValue: (r: CustomerRecord) => r.healthScore },
      }),
      col.display({
        id: 'status',
        header: 'Status',
        cell: (c) => {
          const st = c.row.original.status
          return (
            <Badge tone={st === 'active' ? 'emerald' : st === 'at_risk' ? 'amber' : st === 'dormant' ? 'neutral' : 'rose'} dot>
              {st.replace(/_/g, ' ')}
            </Badge>
          )
        },
        meta: { exportValue: (r: CustomerRecord) => r.status },
      }),
      col.accessor('lastOrderDays', {
        header: 'Last order',
        cell: (c) => <span className={cn('muted', c.getValue() > 110 && 'font-semibold text-rose-600 dark:text-rose-400')}>{c.getValue() === 0 ? 'today' : `${c.getValue()}d ago`}</span>,
        meta: { align: 'right', exportValue: (r: CustomerRecord) => r.lastOrderDays },
      }),
    ],
    [],
  )

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['name', 'segment', 'region', 'status', 'churnRisk', 'lifetimeValue', 'windowRevenue', 'windowOrders', 'aov', 'orders', 'healthScore', 'lastOrderDays', 'since'],
      ...enriched.map((c) => [c.name, c.segment, c.region, c.status, c.churnRisk, c.lifetimeValue, Math.round(c.windowRevenue), c.windowOrders, c.aov, c.orders, c.healthScore, c.lastOrderDays, c.since]),
    ]
    downloadText(`opsboard-customers-${ds.today}.csv`, toCSV(rows))
    pushToast({ kind: 'success', title: 'Account export ready', body: `${rows.length - 1} accounts.` })
  }

  const repRows = useMemo(
    () =>
      [...ds.reps]
        .sort((a, b) => b.attainmentPct - a.attainmentPct)
        .map((r) => ({ name: r.name, sub: `${r.region} · ${fmtInt(r.openDeals)} open deals`, value: r.closedRevenue, pct: (r.closedRevenue / r.quota) * 100 })),
    [ds.reps],
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Head label="Active accounts" value={fmtInt(customers.filter((c) => c.status === 'active').length)} sub={`of ${customers.length} total`} />
        <Head label="Revenue at risk" value={fmtMoney(atRiskRevenue)} sub="lifetime value on at-risk / dormant" tone={atRiskRevenue > 8e6 ? 'risk' : 'watch'} />
        <Head label="Top-10 concentration" value={fmtPct(top10Share, 0)} sub="share of window revenue" tone={top10Share > 32 ? 'watch' : 'ok'} />
        <Head label="New customers (window)" value={fmtInt(ops.cur.newCustomers)} sub={`${ops.kpis.newCustomers.delta !== null ? (ops.kpis.newCustomers.delta >= 0 ? '+' : '') + fmtPct(ops.kpis.newCustomers.delta, 0) : '—'} vs prior ${ops.days}d`} tone={ops.kpis.newCustomers.delta !== null && ops.kpis.newCustomers.delta < 0 ? 'watch' : 'ok'} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card
          className="col-span-12 overflow-hidden xl:col-span-8"
          noPad
          title="Account book"
          subtitle="Ranked by revenue in the current window — the list for Monday standups"
          actions={
            <div className="flex items-center gap-2">
              <TextInput icon={<Search className="h-3.5 w-3.5" />} placeholder="Search accounts…" className="w-44" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search accounts" />
              <Select aria-label="Segment" value={segment} onChange={(e) => setSegment(e.target.value)} options={[{ value: 'all', label: 'All segments' }, ...SEGMENTS.map((s) => ({ value: s, label: s }))]} className="w-32" />
              <Button onClick={() => setAtRiskOnly(!atRiskOnly)} variant={atRiskOnly ? 'primary' : 'secondary'}>At-risk</Button>
              <Button onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
            </div>
          }
        >
          <DataTable data={enriched} columns={columns} rowKey={(c) => c.id} pageSize={14} />
        </Card>

        <div className="col-span-12 space-y-4 xl:col-span-4">
          <Card title="Sales reps — quota attainment" subtitle={`YTD closed vs quota · top ${repRows.length}`}>
            <Leaderboard rows={repRows.map((r) => ({ name: r.name, sub: r.sub, value: r.value, pct: Math.round(r.pct) }))} valueFmt={(n) => fmtMoney(n)} />
          </Card>

          <Card title="Segment mix" subtitle="Lifetime value share by segment">
            {(() => {
              const bySeg = SEGMENTS.map((s) => ({
                s,
                ltv: customers.filter((c) => c.segment === s).reduce((a, c) => a + c.lifetimeValue, 0),
                n: customers.filter((c) => c.segment === s).length,
              }))
              const tot = bySeg.reduce((a, b) => a + b.ltv, 0) || 1
              return (
                <ul className="space-y-2.5">
                  {bySeg.map((b, i) => (
                    <li key={b.s}>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium">{b.s} <span className="muted text-[10px]">· {b.n} accts</span></span>
                        <span className="tnum font-semibold">{fmtMoney(b.ltv)} <span className="muted text-[10px] font-normal">({fmtPct((b.ltv / tot) * 100, 0)})</span></span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className={cn('h-full rounded-full', i === 0 ? 'bg-violet-500' : i === 1 ? 'bg-sky-500' : 'bg-emerald-500')} style={{ width: `${(b.ltv / tot) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )
            })()}
            <p className="muted mt-3 border-t border-slate-100 pt-2 text-[10.5px] dark:border-slate-800">
              Concentration check: if two Enterprise logos churn, ~{fmtMoney(customers.filter((c) => c.segment === 'Enterprise').sort((a, b) => a.lifetimeValue - b.lifetimeValue).slice(0, 2).reduce((x, c) => x + c.lifetimeValue, 0) / 12)} of quarterly revenue walks out with them.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Head({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'watch' | 'risk' }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <p className={cn('tnum mt-1 text-xl font-semibold tracking-tight', tone === 'risk' && 'text-rose-600 dark:text-rose-400', tone === 'watch' && 'text-amber-600 dark:text-amber-400')}>{value}</p>
      {sub && <p className="muted mt-0.5 text-[10.5px]">{sub}</p>}
    </div>
  )
}
