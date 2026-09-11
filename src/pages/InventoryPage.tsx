import { useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Download, PackagePlus, Search } from 'lucide-react'
import { CATEGORIES, type Category } from '../data/model'
import { useOps, useDataset } from '../data/selectors'
import type { SkuComputed } from '../data/selectors'
import { useFocusParam } from '../lib/useFocusParam'
import { DataTable } from '../components/ui/DataTable'
import { Badge, Button, Card, ProgressBar, Select, TextInput } from '../components/ui/primitives'
import { StatusBadge, STOCK_STATUS_TONE } from '../components/shared'
import { CategoryBars } from '../components/charts/CategoryBars'
import { fmtInt, fmtMoney, fmtPct } from '../lib/format'
import { downloadText, toCSV } from '../lib/csv'
import { useStore } from '../state/store'
import { groupBy } from '../lib/util'
import { cn } from '../lib/cn'

const col = createColumnHelper<SkuComputed>()

const STATUS_LABEL: Record<SkuComputed['status'], string> = {
  out_of_stock: 'Out of stock',
  critical: 'Critical',
  low: 'Low',
  healthy: 'Healthy',
}

export function InventoryPage() {
  const ds = useDataset()
  const pushToast = useStore((s) => s.pushToast)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [riskOnly, setRiskOnly] = useState(false)
  const [focusSku, clearFocus] = useFocusParam()

  useEffect(() => {
    if (focusSku) {
      setSearch(focusSku)
      clearFocus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSku])

  const ops = useOps()
  const items = ops.stock.items

  const filtered = useMemo(() => {
    let rows = items
    if (cat !== 'all') rows = rows.filter((s) => s.category === cat)
    if (riskOnly) rows = rows.filter((s) => s.status !== 'healthy')
    if (search.trim()) {
      const v = search.trim().toLowerCase()
      rows = rows.filter((s) => [s.sku, s.name, s.category, s.supplier].some((x) => x.toLowerCase().includes(v)))
    }
    return rows
  }, [items, cat, riskOnly, search])

  const columns = useMemo(
    () => [
      col.accessor('sku', {
        header: 'SKU',
        cell: (c) => <span className="font-mono text-[11px] font-semibold">{c.getValue()}</span>,
        meta: { exportValue: (s: SkuComputed) => s.sku },
      }),
      col.accessor('name', {
        header: 'Item',
        cell: (c) => (
          <span className="flex max-w-52 flex-col leading-tight">
            <span className="truncate font-medium">{c.getValue()}</span>
            <span className="muted text-[10px]">{c.row.original.category}</span>
          </span>
        ),
        meta: { exportValue: (s: SkuComputed) => s.name },
      }),
      col.accessor('totalStock', {
        header: 'On hand',
        cell: (c) => fmtInt(c.getValue()),
        meta: { align: 'right', exportValue: (s: SkuComputed) => s.totalStock },
      }),
      col.accessor('dailyDemand', {
        header: 'Daily dem.',
        cell: (c) => <span className="muted">{c.getValue().toFixed(1)}</span>,
        meta: { align: 'right', exportValue: (s: SkuComputed) => s.dailyDemand },
      }),
      col.display({
        id: 'cover',
        header: 'Days of cover',
        cell: (c) => {
          const s = c.row.original
          const healthy = s.daysOfCover >= s.leadTimeDays
          return (
            <span className="flex w-36 items-center gap-2">
              <span className={cn('tnum w-12 text-right text-[11px] font-semibold', !healthy && 'text-rose-600 dark:text-rose-400')}>
                {s.daysOfCover > 365 ? '1y+' : `${Math.round(s.daysOfCover)}d`}
              </span>
              <ProgressBar
                value={Math.min(100, (s.daysOfCover / Math.max(1, s.leadTimeDays * 2.2)) * 100)}
                tone={s.status === 'healthy' ? 'emerald' : s.status === 'low' ? 'amber' : 'rose'}
                className="flex-1"
              />
            </span>
          )
        },
        meta: { align: 'right', exportValue: (s: SkuComputed) => Math.round(s.daysOfCover) },
      }),
      col.display({
        id: 'status',
        header: 'Status',
        cell: (c) => <StatusBadge status={c.row.original.status} tone={STOCK_STATUS_TONE[c.row.original.status]} />,
        meta: { exportValue: (s: SkuComputed) => STATUS_LABEL[s.status] },
      }),
      col.accessor('stockValue', {
        header: 'Value',
        cell: (c) => <span className="font-semibold">{fmtMoney(c.getValue())}</span>,
        meta: { align: 'right', exportValue: (s: SkuComputed) => s.stockValue.toFixed(0) },
      }),
      col.accessor('supplier', {
        header: 'Supplier · lead',
        cell: (c) => (
          <span className="flex flex-col items-end leading-tight">
            <span className="max-w-36 truncate">{c.getValue()}</span>
            <span className="muted text-[10px]">{c.row.original.leadTimeDays}d lead</span>
          </span>
        ),
        meta: { align: 'right', exportValue: (s: SkuComputed) => `${s.supplier} (${s.leadTimeDays}d)` },
      }),
    ],
    [],
  )

  const catData = useMemo(() => {
    const m = groupBy(items, (s) => s.category)
    return [...m.entries()].map(([category, list]) => ({
      category,
      value: list.reduce((a, b) => a + b.stockValue, 0),
      atRisk: list.filter((s) => s.status === 'critical' || s.status === 'out_of_stock').reduce((a, b) => a + b.stockValue, 0),
    }))
  }, [items])

  const queue = useMemo(
    () =>
      [...items]
        .filter((s) => s.status !== 'healthy')
        .sort((a, b) => a.daysOfCover - b.daysOfCover)
        .slice(0, 8),
    [items],
  )

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['sku', 'name', 'category', 'supplier', 'leadTimeDays', 'totalStock', 'dailyDemand', 'daysOfCover', 'status', 'stockValue'],
      ...filtered.map((s) => [s.sku, s.name, s.category, s.supplier, s.leadTimeDays, s.totalStock, s.dailyDemand, Math.round(s.daysOfCover), STATUS_LABEL[s.status], s.stockValue.toFixed(0)]),
    ]
    downloadText(`opsboard-inventory-${ds.today}.csv`, toCSV(rows))
    pushToast({ kind: 'success', title: 'Inventory snapshot exported', body: `${rows.length - 1} SKUs.` })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Head label="Inventory value (avg)" value={fmtMoney(ops.kpis.inventoryValue.value)} sub={`${ops.days}d average across warehouses`} />
        <Head label="Out of stock" value={fmtInt(ops.stock.outOfStock.length)} sub="SKUs at zero on-hand" tone={ops.stock.outOfStock.length ? 'risk' : 'ok'} />
        <Head label="Below lead time" value={fmtInt(ops.stock.critical.length)} sub="won't restock before stock runs out" tone={ops.stock.critical.length > 3 ? 'risk' : 'watch'} />
        <Head label="Avg days of cover" value={`${Math.round(ops.stock.avgCoverDays)}d`} sub={`≈ ${fmtMoney(ops.stock.atRiskWeeklyDemand / 4)} weekly demand at risk`} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card
          className="col-span-12 overflow-hidden xl:col-span-8"
          noPad
          title="SKU ledger"
          subtitle="Stock cover vs supplier lead time — the number that decides replenishment"
          actions={
            <div className="flex items-center gap-2">
              <TextInput icon={<Search className="h-3.5 w-3.5" />} placeholder="Search SKU, item, supplier…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" aria-label="Search SKUs" />
              <Select
                aria-label="Category"
                value={cat}
                onChange={(e) => setCat(e.target.value as Category | 'all')}
                options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
                className="w-40"
              />
              <Button onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
            </div>
          }
        >
          <div className="mb-2 flex items-center gap-2 px-4 text-[11px]">
            <button
              type="button"
              onClick={() => setRiskOnly(!riskOnly)}
              className={cn(
                'rounded-full border px-2.5 py-1 font-semibold transition-colors',
                riskOnly
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
              )}
            >
              {riskOnly ? 'Showing at-risk only' : 'Show at-risk only'}
            </button>
            <span className="muted">{fmtInt(filtered.length)} of {fmtInt(items.length)} SKUs</span>
          </div>
          <div className="px-2 pb-2">
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(s) => s.sku}
              pageSize={16}
              initialSorting={[{ id: 'cover', desc: false }]}
            />
          </div>
        </Card>

        <div className="col-span-12 space-y-4 xl:col-span-4">
          <Card title="Replenishment queue" subtitle="Sorted by urgency — cover vs lead time" info="Suggested PO = demand × (lead time + safety week) − on-hand.">
            {queue.length === 0 ? (
              <p className="py-6 text-center text-xs text-emerald-600 dark:text-emerald-400">Every SKU is above its risk line. 🎉</p>
            ) : (
              <ul className="-mx-1 space-y-1">
                {queue.map((s) => (
                  <li key={s.sku} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {s.name} <span className="muted font-mono text-[10px] font-normal">{s.sku}</span>
                      </p>
                      <p className="muted text-[10.5px]">
                        {Math.round(s.daysOfCover)}d cover · {s.leadTimeDays}d lead · {s.supplier}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum text-[11px] font-bold">PO {fmtInt(s.suggestedPo)}</p>
                      <p className="muted text-[9.5px]">≈ {fmtMoney(s.suggestedPo * s.cost)} COGS</p>
                    </div>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => pushToast({ kind: 'success', title: `PO raised — ${s.sku}`, body: `Draft purchase order for ${fmtInt(s.suggestedPo)} units sent to ${s.supplier}.` })}
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Inventory value by category" subtitle="Amber = value sitting on at-risk SKUs">
            <CategoryBars data={catData} height={230} />
          </Card>

          <Card title="Warehouse snapshot" subtitle="On-hand value and SKU coverage per site">
            <ul className="space-y-2">
              {ds.warehouses.map((w) => {
                const stockAt = items.reduce((acc, s) => acc + s.stock.filter((x) => x.warehouse === w.code).reduce((a, b) => a + b.qty * s.cost, 0), 0)
                const skuCount = items.filter((s) => s.stock.some((x) => x.warehouse === w.code)).length
                return (
                  <li key={w.code} className="flex items-center gap-3 text-xs">
                    <span className="flex h-7 w-11 shrink-0 items-center justify-center rounded-md bg-slate-900 font-mono text-[10px] font-bold text-white dark:bg-slate-700">{w.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{w.city}</span>
                      <span className="muted block text-[10px]">{w.region}</span>
                    </span>
                    <Badge tone="neutral">{skuCount} SKUs</Badge>
                    <span className="tnum w-16 text-right font-semibold">{fmtMoney(stockAt)}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Stockout events" subtitle={`${fmtInt(ops.cur.stockoutEvents)} line-item stockouts in the window (${fmtPct(ops.kpis.stockouts.delta ?? 0, 0)} vs prior period)`} info="Counted from daily WMS aggregates for the filtered region scope.">
        <StockoutStrip series={ops.stockoutTrend} />
      </Card>
    </div>
  )
}

function Head({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'risk' | 'watch' }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <p className={cn('tnum mt-1 text-xl font-semibold tracking-tight', tone === 'risk' && 'text-rose-600 dark:text-rose-400', tone === 'watch' && 'text-amber-600 dark:text-amber-400')}>{value}</p>
      {sub && <p className="muted mt-0.5 text-[10.5px]">{sub}</p>}
    </div>
  )
}

function StockoutStrip({ series }: { series: { label: string; value: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.value))
  return (
    <div>
      <div className="flex h-16 items-end gap-[3px]" role="img" aria-label="Stockout events per period bucket">
        {series.map((s, i) => (
          <div
            key={i}
            className="min-w-[2px] flex-1 rounded-sm bg-amber-400/80 transition-transform hover:scale-y-110 hover:bg-amber-500 dark:bg-amber-500/50"
            style={{ height: `${Math.max(4, (s.value / max) * 100)}%` }}
            title={`${s.label}: ${s.value} stockout events`}
          />
        ))}
      </div>
      <div className="muted mt-1.5 flex justify-between text-[10.5px]">
        <span>{series[0]?.label}</span>
        <span>peak {max}/bucket</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  )
}
