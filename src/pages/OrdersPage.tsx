import { useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Download, Flame, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { OrderRecord, OrderStatus } from '../data/model'
import { ORDER_STATUSES } from '../data/model'
import { useOps, useDataset } from '../data/selectors'
import { DataTable } from '../components/ui/DataTable'
import { Sheet } from '../components/ui/Sheet'
import { Badge, Button, Card, Select, TextInput } from '../components/ui/primitives'
import { orderSlaState, ORDER_STATUS_TONE, StatusBadge } from '../components/shared'
import { fmtDay, fmtDateTime, fmtInt, fmtMoney, fmtMoney2, fmtPct } from '../lib/format'
import { downloadText, toCSV } from '../lib/csv'
import { useStore } from '../state/store'
import { cn } from '../lib/cn'
import { safeDiv, sumBy } from '../lib/util'

const col = createColumnHelper<OrderRecord>()

export function OrdersPage() {
  const ops = useOps()
  const ds = useDataset()
  const pushToast = useStore((s) => s.pushToast)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus')
  const [selected, setSelected] = useState<OrderRecord | null>(() =>
    focusId ? (ops.scopedOrders.find((o) => o.id === focusId) ?? null) : null,
  )

  const data = useMemo(() => {
    let rows = ops.scopedOrders
    if (status !== 'all') rows = rows.filter((o) => o.status === status)
    if (search.trim()) {
      const v = search.trim().toLowerCase()
      rows = rows.filter((o) => [o.id, o.customer, o.region, o.channel, o.status, o.rep, o.warehouse].some((s) => String(s).toLowerCase().includes(v)))
    }
    return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [ops.scopedOrders, status, search])

  const statusCounts = useMemo(() => {
    const m = new Map<OrderStatus, number>()
    for (const o of ops.scopedOrders) m.set(o.status, (m.get(o.status) ?? 0) + 1)
    return m
  }, [ops.scopedOrders])

  const columns = useMemo(
    () => [
      col.accessor('id', {
        header: 'Order',
        cell: (ctx) => (
          <span className="font-mono text-[11px] font-semibold">
            {ctx.getValue()}
            {ctx.row.original.priorityRush && <Flame className="ml-1 inline h-3 w-3 text-orange-500" aria-label="Rush order" />}
          </span>
        ),
        meta: { exportValue: (o: OrderRecord) => o.id },
      }),
      col.accessor('customer', {
        header: 'Customer',
        cell: (ctx) => (
          <span className="flex max-w-44 flex-col">
            <span className="truncate font-medium">{ctx.getValue()}</span>
            <span className="muted truncate text-[10px]">{ctx.row.original.segment} · {ctx.row.original.rep}</span>
          </span>
        ),
        meta: { exportValue: (o: OrderRecord) => o.customer },
      }),
      col.accessor('day', {
        header: 'Placed',
        cell: (ctx) => <span className="muted">{fmtDay(ctx.getValue())}</span>,
        meta: { exportValue: (o: OrderRecord) => o.day },
      }),
      col.accessor('region', {
        header: 'Region / Channel',
        cell: (ctx) => (
          <span className="flex flex-col leading-tight">
            <span>{ctx.getValue()}</span>
            <span className="muted text-[10px]">{ctx.row.original.channel} · {ctx.row.original.warehouse}</span>
          </span>
        ),
        meta: { exportValue: (o: OrderRecord) => `${o.region}/${o.channel}` },
      }),
      col.accessor('value', {
        header: 'Value',
        cell: (ctx) => <span className="font-semibold">{fmtMoney2(ctx.getValue())}</span>,
        meta: { align: 'right', exportValue: (o: OrderRecord) => o.value.toFixed(2) },
      }),
      col.accessor('itemCount', {
        header: 'Units',
        cell: (ctx) => <span className="muted">{fmtInt(ctx.getValue())}</span>,
        meta: { align: 'right', exportValue: (o: OrderRecord) => o.itemCount },
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (ctx) => <StatusBadge status={ctx.getValue() as OrderStatus} tone={ORDER_STATUS_TONE[ctx.getValue() as OrderStatus]} />,
        meta: { exportValue: (o: OrderRecord) => o.status },
      }),
      col.accessor('promiseDate', {
        header: 'Promise & SLA',
        cell: (ctx) => {
          const o = ctx.row.original
          const sla = orderSlaState({ ...o, today: ds.today })
          return (
            <span className="flex flex-col items-end gap-0.5">
              <Badge tone={sla.tone} className="!py-0 !text-[10px]">{sla.label}</Badge>
              <span className="muted text-[10px]">promise {fmtDay(o.promiseDate)}</span>
            </span>
          )
        },
        meta: { align: 'right', exportValue: (o: OrderRecord) => o.promiseDate },
      }),
    ],
    [ds.today],
  )

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['id', 'placed', 'customer', 'segment', 'region', 'channel', 'warehouse', 'rep', 'status', 'value', 'units', 'promiseDate', 'carrier', 'delayReason'],
      ...data.map((o) => [o.id, o.createdAt, o.customer, o.segment, o.region, o.channel, o.warehouse, o.rep, o.status, o.value.toFixed(2), o.itemCount, o.promiseDate, o.carrier, o.delayReason ?? '']),
    ]
    downloadText(`opsboard-orders-${ds.today}.csv`, toCSV(rows))
    pushToast({ kind: 'success', title: 'CSV exported', body: `${rows.length - 1} rows — matches current filters.` })
  }

  // window stats strip
  const stats = useMemo(() => {
    const o = ops.scopedOrders
    const delivered = o.filter((x) => x.status === 'delivered')
    const onTime = delivered.filter((x) => !x.deliveredAt || x.deliveredAt.slice(0, 10) <= x.promiseDate)
    const delayed = o.filter((x) => x.status === 'delayed')
    return {
      orders: o.length,
      value: sumBy(o, (x) => x.value),
      onTimePct: safeDiv(onTime.length, delivered.length) * 100,
      delayed: delayed.length,
      delayedValue: sumBy(delayed, (x) => x.value),
      inFlight: o.filter((x) => ['pending', 'picking', 'in_transit'].includes(x.status)).length,
    }
  }, [ops.scopedOrders])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Orders in window" value={fmtInt(stats.orders)} sub={`${fmtMoney(stats.value)} captured`} />
        <MiniStat label="Delivered on time" value={fmtPct(stats.onTimePct, 1)} sub={`of delivered orders (${ops.days}d)`} tone={stats.onTimePct >= 94 ? 'ok' : stats.onTimePct >= 90 ? 'watch' : 'risk'} />
        <MiniStat label="Open & in flight" value={fmtInt(stats.inFlight)} sub="pending → shipped" />
        <MiniStat label="Delayed" value={fmtInt(stats.delayed)} sub={`${fmtMoney(stats.delayedValue)} at risk`} tone={stats.delayed > 40 ? 'risk' : stats.delayed > 20 ? 'watch' : 'ok'} />
      </div>

      <Card
        noPad
        title="Order book"
        subtitle={`${fmtInt(data.length)} sampled order records — click any row for the full timeline`}
        className="overflow-hidden"
        actions={
          <div className="flex items-center gap-2">
            <TextInput
              icon={<Search className="h-3.5 w-3.5" />}
              placeholder="Search order, customer, rep…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
              aria-label="Search orders"
            />
            <Select
              aria-label="Filter status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus | 'all')}
              options={[
                { value: 'all', label: `All statuses (${stats.orders})` },
                ...ORDER_STATUSES.map((s) => ({ value: s, label: `${s.replace(/_/g, ' ')} (${statusCounts.get(s) ?? 0})` })),
              ]}
              className="w-44 capitalize"
            />
            <Button onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        }
      >
        <div className="px-2 pb-2">
          <DataTable
            data={data}
            columns={columns}
            globalFilter={search}
            onRowClick={(o) => setSelected(o)}
            rowKey={(o) => o.id}
            empty={
              <div className="py-10 text-center">
                <p className="text-sm font-medium">No orders match</p>
                <p className="muted mt-1 text-xs">Try clearing “{search}” or the status filter.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="xs" onClick={() => setSearch('')}>
                    <X className="h-3 w-3" /> Clear search
                  </Button>
                  <Button size="xs" onClick={() => setStatus('all')}>
                    All statuses
                  </Button>
                </div>
              </div>
            }
          />
        </div>
      </Card>

      <OrderSheet order={selected} onClose={() => { setSelected(null); setParams({}) }} />
    </div>
  )
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'watch' | 'risk' }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <p className={cn('tnum mt-1 text-xl font-semibold tracking-tight', tone === 'risk' && 'text-rose-600 dark:text-rose-400', tone === 'watch' && 'text-amber-600 dark:text-amber-400')}>{value}</p>
      {sub && <p className="muted mt-0.5 text-[10.5px]">{sub}</p>}
    </div>
  )
}

function TimelineRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 text-[12px] last:border-0 dark:border-slate-800">
      <span className="muted">{label}</span>
      <span className={cn('font-medium', tone)}>{value}</span>
    </div>
  )
}

export function OrderSheet({ order, onClose }: { order: OrderRecord | null; onClose: () => void }) {
  const ds = useDataset()
  return (
    <Sheet
      open={!!order}
      onClose={onClose}
      title={
        order ? (
          <span className="flex items-center gap-2">
            <span className="font-mono">{order.id}</span>
            <StatusBadge status={order.status} tone={ORDER_STATUS_TONE[order.status]} />
            {order.priorityRush && <Badge tone="amber">RUSH</Badge>}
          </span>
        ) : null
      }
      subtitle={order ? `${order.customer} · ${order.region} · ${order.channel}` : undefined}
      footer={
        order && (
          <div className="flex items-center justify-between text-xs">
            <span className="muted">Order value</span>
            <span className="tnum text-sm font-semibold">{fmtMoney2(order.value)}</span>
          </div>
        )
      }
    >
      {order && (
        <div className="space-y-5 text-[12.5px]">
          {order.delayReason && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/[0.07] dark:text-amber-300">
              <span className="text-[11px] leading-snug">
                <b>Delay flagged:</b> {order.delayReason}. Promise date missed — customer notified by the {order.rep.toLowerCase()} desk.
              </span>
            </div>
          )}

          <div>
            <h4 className="mb-1 text-[10.5px] font-semibold tracking-wide text-slate-400 uppercase">Timeline</h4>
            <TimelineRow label="Placed" value={fmtDateTime(order.createdAt)} />
            <TimelineRow label="Warehouse" value={`${order.warehouse} (${ds.warehouses.find((w) => w.code === order.warehouse)?.city ?? '—'})`} />
            <TimelineRow label="Shipped" value={order.shippedAt ? fmtDateTime(order.shippedAt) : '—'} />
            <TimelineRow label="Promised" value={fmtDay(order.promiseDate, 'medium')} tone="text-emerald-600 dark:text-emerald-400" />
            <TimelineRow label="Delivered" value={order.deliveredAt ? fmtDateTime(order.deliveredAt) : '—'} />
            <TimelineRow label="Carrier" value={order.carrier} />
          </div>

          <div>
            <h4 className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-slate-400 uppercase">Lines ({order.lines.length})</h4>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="muted text-left">
                  <th className="pb-1 font-medium">SKU</th>
                  <th className="pb-1 font-medium">Item</th>
                  <th className="pb-1 text-right font-medium">Qty</th>
                  <th className="pb-1 text-right font-medium">Unit</th>
                  <th className="pb-1 text-right font-medium">Ext</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l, i) => (
                  <tr key={`${l.sku}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 font-mono text-[10px]">{l.sku}</td>
                    <td className="max-w-36 truncate py-1">{l.name}</td>
                    <td className="tnum py-1 text-right">{l.qty}</td>
                    <td className="tnum muted py-1 text-right">{fmtMoney2(l.unitPrice)}</td>
                    <td className="tnum py-1 text-right font-medium">{fmtMoney2(l.qty * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-slate-400 uppercase">Customer context</h4>
            {(() => {
              const c = ds.customers.find((x) => x.id === order.customerId)
              if (!c) return <p className="muted text-xs">No account record.</p>
              return (
                <div className="card !rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.name}</span>
                    <Badge tone={c.status === 'active' ? 'emerald' : c.status === 'at_risk' ? 'amber' : 'rose'} dot>
                      {c.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="muted mt-1.5 grid grid-cols-3 gap-2 text-[10.5px]">
                    <span>LT <b className="text-slate-700 dark:text-slate-200">{fmtMoney(c.lifetimeValue)}</b></span>
                    <span>Orders <b className="text-slate-700 dark:text-slate-200">{c.orders}</b></span>
                    <span>Health <b className={cn('text-slate-700 dark:text-slate-200', c.healthScore < 55 && 'text-rose-600 dark:text-rose-400')}>{c.healthScore}</b></span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </Sheet>
  )
}
