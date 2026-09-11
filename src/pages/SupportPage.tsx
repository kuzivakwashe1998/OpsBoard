import { useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import dayjs from 'dayjs'
import { Download, Search } from 'lucide-react'
import type { TicketRecord } from '../data/model'
import { PRIORITIES } from '../data/model'
import { useOps, useDataset } from '../data/selectors'
import { DataTable } from '../components/ui/DataTable'
import { Badge, Button, Card, Select, TextInput } from '../components/ui/primitives'
import { PRIORITY_TONE, StatusBadge, TICKET_STATUS_TONE, ticketSlaState } from '../components/shared'
import { Heatmap } from '../components/ui/Heatmap'
import { Gauge } from '../components/ui/Gauge'
import { Leaderboard } from '../components/charts/RegionBars'
import { Sheet } from '../components/ui/Sheet'
import { fmtDateTime, fmtDurationMin, fmtHours, fmtInt, fmtPct } from '../lib/format'
import { downloadText, toCSV } from '../lib/csv'
import { useStore } from '../state/store'
import { groupBy } from '../lib/util'
import { cn } from '../lib/cn'

const col = createColumnHelper<TicketRecord>()

type StatusFilter = 'all' | 'needs_reply' | 'in_progress' | 'waiting' | 'resolved' | 'breached'

export function SupportPage() {
  const ds = useDataset()
  const ops = useOps()
  const pushToast = useStore((s) => s.pushToast)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('needs_reply')
  const [priority, setPriority] = useState<string>('all')
  const [selected, setSelected] = useState<TicketRecord | null>(null)

  const nowMs = new Date(ds.generatedAt).getTime()

  const filtered = useMemo(() => {
    let rows = ops.windowedTickets
    if (statusFilter === 'needs_reply') rows = rows.filter((t) => t.status === 'open')
    else if (statusFilter === 'in_progress') rows = rows.filter((t) => t.status === 'in_progress')
    else if (statusFilter === 'waiting') rows = rows.filter((t) => t.status === 'waiting_customer')
    else if (statusFilter === 'resolved') rows = rows.filter((t) => t.status === 'resolved')
    else if (statusFilter === 'breached') rows = rows.filter((t) => t.breached)
    if (priority !== 'all') rows = rows.filter((t) => t.priority === priority)
    if (search.trim()) {
      const v = search.trim().toLowerCase()
      rows = rows.filter((t) => [t.id, t.subject, t.customer, t.agent].some((x) => x.toLowerCase().includes(v)))
    }
    // most urgent first: overdue open tickets by time remaining, then the rest by recency
    return [...rows].sort((a, b) => {
      const dueA = Date.parse(a.createdAt) + a.slaHours * 3_600_000
      const dueB = Date.parse(b.createdAt) + b.slaHours * 3_600_000
      const aOpen = a.status !== 'resolved'
      const bOpen = b.status !== 'resolved'
      if (aOpen !== bOpen) return aOpen ? -1 : 1
      if (aOpen) return dueA - dueB
      return a.createdAt < b.createdAt ? 1 : -1
    })
  }, [ops.windowedTickets, statusFilter, priority, search])

  const byPriority = useMemo(() => {
    return PRIORITIES.map((p) => {
      const list = ops.windowedTickets.filter((t) => t.priority === p)
      const resolved = list.filter((t) => t.resolvedAt)
      const ok = resolved.filter((t) => (Date.parse(t.resolvedAt!) - Date.parse(t.createdAt)) / 3_600_000 <= t.slaHours)
      const openFr = list.filter((t) => t.firstResponseAt).map((t) => dayjs(t.firstResponseAt!).diff(t.createdAt, 'minute'))
      return {
        priority: p,
        total: list.length,
        open: list.filter((t) => t.status !== 'resolved').length,
        attain: resolved.length ? (ok.length / resolved.length) * 100 : 100,
        avgFr: openFr.length ? openFr.reduce((a, b) => a + b, 0) / openFr.length : 0,
      }
    })
  }, [ops.windowedTickets])

  const agents = useMemo(() => {
    const m = groupBy(ops.windowedTickets, (t) => t.agent)
    return [...m.entries()]
      .map(([name, list]) => {
        const resolved = list.filter((t) => t.resolvedAt)
        const fr = list.filter((t) => t.firstResponseAt).map((t) => dayjs(t.firstResponseAt!).diff(t.createdAt, 'minute'))
        return {
          name,
          resolved: resolved.length,
          avgFr: fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : 0,
          breaches: list.filter((t) => t.breached).length,
        }
      })
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 8)
  }, [ops.windowedTickets])

  const columns = useMemo(
    () => [
      col.accessor('id', {
        header: 'Ticket',
        cell: (c) => <span className="font-mono text-[11px] font-semibold">{c.getValue()}</span>,
        meta: { exportValue: (t: TicketRecord) => t.id },
      }),
      col.accessor('subject', {
        header: 'Subject / customer',
        cell: (c) => (
          <span className="flex max-w-64 flex-col leading-tight">
            <span className="truncate font-medium">{c.getValue()}</span>
            <span className="muted truncate text-[10px]">{c.row.original.customer} · {c.row.original.region}</span>
          </span>
        ),
        meta: { exportValue: (t: TicketRecord) => t.subject },
      }),
      col.accessor('priority', {
        header: 'Priority',
        cell: (c) => <StatusBadge status={c.getValue()} tone={PRIORITY_TONE[c.getValue() as TicketRecord['priority']]} />,
        meta: { exportValue: (t: TicketRecord) => t.priority },
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (c) => <StatusBadge status={c.getValue()} tone={TICKET_STATUS_TONE[c.getValue() as TicketRecord['status']]} />,
        meta: { exportValue: (t: TicketRecord) => t.status },
      }),
      col.accessor('createdAt', {
        header: 'Opened',
        cell: (c) => <span className="muted">{fmtDateTime(c.getValue())}</span>,
        meta: { exportValue: (t: TicketRecord) => t.createdAt },
      }),
      col.accessor('agent', {
        header: 'Agent',
        cell: (c) => <span>{c.getValue()}</span>,
        meta: { exportValue: (t: TicketRecord) => t.agent },
      }),
      col.display({
        id: 'sla',
        header: 'SLA',
        cell: (c) => {
          const t = c.row.original
          const s = ticketSlaState(t, nowMs)
          return (
            <span className="flex flex-col items-end gap-0.5">
              <Badge tone={s.tone} className={cn('!py-0 !text-[10px]', t.status !== 'resolved' && s.tone === 'rose' && 'animate-pulse')}>
                {s.label}
              </Badge>
              <span className="muted text-[10px]">{t.slaHours}h target</span>
            </span>
          )
        },
        meta: { align: 'right', exportValue: (t: TicketRecord) => (t.breached ? 'BREACHED' : 'in SLA') },
      }),
    ],
    [nowMs],
  )

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['id', 'subject', 'customer', 'region', 'priority', 'status', 'tag', 'agent', 'createdAt', 'firstResponseAt', 'resolvedAt', 'slaHours', 'breached'],
      ...filtered.map((t) => [t.id, t.subject, t.customer, t.region, t.priority, t.status, t.tag, t.agent, t.createdAt, t.firstResponseAt ?? '', t.resolvedAt ?? '', t.slaHours, t.breached ? 'yes' : 'no']),
    ]
    downloadText(`opsboard-tickets-${ds.today}.csv`, toCSV(rows))
    pushToast({ kind: 'success', title: 'Ticket export ready', body: `${rows.length - 1} rows.` })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Head label="Backlog" value={fmtInt(ops.openBacklog)} sub="unresolved right now" tone={ops.openBacklog > 28 ? 'risk' : ops.openBacklog > 16 ? 'watch' : 'ok'} />
        <Head label="Past SLA" value={fmtInt(ops.overdueOpen)} sub="open & out of contract" tone={ops.overdueOpen > 0 ? 'risk' : 'ok'} />
        <Head label="SLA attainment" value={fmtPct(ops.slaAttainPct, 0)} sub={`of ${fmtInt(ops.cur.ticketsOpened)} windowed tickets`} tone={ops.slaAttainPct >= 95 ? 'ok' : ops.slaAttainPct >= 90 ? 'watch' : 'risk'} />
        <Head label="Avg first response" value={fmtDurationMin(ops.kpis.firstResp.value)} sub={`target ≤45m · ${ops.kpis.firstResp.delta !== null ? (ops.kpis.firstResp.delta >= 0 ? '+' : '') + ops.kpis.firstResp.delta.toFixed(0) + '% vs prior' : 'n/a'}`} />
        <Head label="Volume" value={fmtInt(ops.cur.ticketsOpened)} sub={`tickets opened in ${ops.days}d`} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card
          className="col-span-12 overflow-hidden xl:col-span-8"
          noPad
          title="Ticket desk"
          subtitle="Urgent-first ordering: open tickets by SLA clock, resolved by recency"
          actions={
            <div className="flex items-center gap-2">
              <TextInput icon={<Search className="h-3.5 w-3.5" />} placeholder="Search tickets…" className="w-44" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tickets" />
              <Select
                aria-label="Priority filter"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={[{ value: 'all', label: 'All priorities' }, ...PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))]}
                className="w-32"
              />
              <Button onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1 pb-2">
            {(
              [
                ['needs_reply', 'Needs reply (open)'],
                ['in_progress', 'In progress'],
                ['waiting', 'Waiting on customer'],
                ['breached', 'SLA breached'],
                ['resolved', 'Resolved'],
                ['all', 'All'],
              ] as [StatusFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  statusFilter === id
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400',
                )}
              >
                {label}
              </button>
            ))}
            <span className="muted ml-auto text-[11px]">{fmtInt(filtered.length)} shown</span>
          </div>
          <div className="px-2 pb-2">
            <DataTable data={filtered} columns={columns} rowKey={(t) => t.id} pageSize={14} onRowClick={setSelected} />
          </div>
        </Card>

        <div className="col-span-12 space-y-4 xl:col-span-4">
          <div className="card flex items-center gap-4 px-4 py-4">
            <Gauge value={ops.slaAttainPct} size={104} sublabel="SLA" tone={ops.slaAttainPct >= 95 ? 'emerald' : ops.slaAttainPct >= 90 ? 'amber' : 'rose'} />
            <div className="min-w-0 text-xs">
              <p className="font-semibold">SLA health this window</p>
              <p className="muted mt-1 leading-relaxed">
                {ops.cur.ticketsResolved} resolved · {ops.openBacklog} open · {ops.overdueOpen} past due.
                Every breached critical auto-escalates to the on-call lead.
              </p>
            </div>
          </div>

          <Card title="Attainment by priority" subtitle="Resolved-in-SLA share and first response">
            <table className="w-full text-xs">
              <thead>
                <tr className="muted text-left text-[10px] tracking-wide uppercase">
                  <th className="pb-1.5 font-semibold">Priority</th>
                  <th className="pb-1.5 text-right font-semibold">Open</th>
                  <th className="pb-1.5 text-right font-semibold">Total</th>
                  <th className="pb-1.5 text-right font-semibold">SLA</th>
                  <th className="pb-1.5 text-right font-semibold">1st reply</th>
                </tr>
              </thead>
              <tbody>
                {byPriority.map((r) => (
                  <tr key={r.priority} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5"><StatusBadge status={r.priority} tone={PRIORITY_TONE[r.priority as TicketRecord['priority']]} /></td>
                    <td className="tnum py-1.5 text-right">{r.open}</td>
                    <td className="tnum muted py-1.5 text-right">{r.total}</td>
                    <td className={cn('tnum py-1.5 text-right font-semibold', r.attain >= 95 ? 'text-emerald-600 dark:text-emerald-400' : r.attain >= 88 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')}>{fmtPct(r.attain, 0)}</td>
                    <td className="tnum muted py-1.5 text-right">{fmtDurationMin(r.avgFr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Agent leaderboard" subtitle={`Resolved volume in window · avg first reply`}>
            <Leaderboard
              rows={agents.map((a) => ({ name: a.name, sub: `${fmtHours(a.avgFr / 60)} avg reply${a.breaches ? ` · ${a.breaches} breach${a.breaches > 1 ? 'es' : ''}` : ''}`, value: a.resolved }))}
              valueFmt={(n) => `${fmtInt(n)}`}
            />
          </Card>

          <Card title="Arrival pattern" subtitle="When customers open tickets (trailing 60d)">
            <Heatmap grid={ds.hourlyByDow} maxLabel="busiest" />
          </Card>
        </div>
      </div>

      <TicketSheet ticket={selected} onClose={() => setSelected(null)} nowMs={nowMs} />
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

function TicketSheet({ ticket, onClose, nowMs }: { ticket: TicketRecord | null; onClose: () => void; nowMs: number }) {
  return (
    <Sheet
      open={!!ticket}
      onClose={onClose}
      title={ticket ? <span className="flex items-center gap-2"><span className="font-mono">{ticket.id}</span><StatusBadge status={ticket.priority} tone={PRIORITY_TONE[ticket.priority]} /></span> : null}
      subtitle={ticket ? `${ticket.subject} — ${ticket.customer}` : undefined}
    >
      {ticket && (
        <div className="space-y-4 text-[12.5px]">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={ticket.status} tone={TICKET_STATUS_TONE[ticket.status]} />
            <Badge tone="neutral">#{ticket.tag}</Badge>
            <Badge tone="sky">Agent: {ticket.agent}</Badge>
          </div>
          <div className="card rounded-lg px-3 py-2.5 text-xs">
            <p className="muted mb-1 text-[10px] font-semibold tracking-wide uppercase">SLA</p>
            <p className="flex items-center justify-between"><span>Target resolution</span><b>{ticket.slaHours}h from open</b></p>
            <p className="muted mt-1 flex items-center justify-between text-[11px]"><span>State</span><b>{ticketSlaState(ticket, nowMs).label}</b></p>
          </div>
          <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-4 dark:border-slate-700">
            {[
              { t: ticket.createdAt, label: 'Customer opened ticket', tone: 'bg-slate-400' },
              { t: ticket.firstResponseAt, label: 'First response sent', tone: 'bg-sky-500' },
              { t: ticket.resolvedAt, label: 'Resolved', tone: ticket.breached ? 'bg-amber-500' : 'bg-emerald-500' },
            ]
              .filter((e) => e.t)
              .map((e, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute top-1 -left-[21.5px] h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900', e.tone)} />
                  <p className="text-xs font-semibold">{e.label}</p>
                  <p className="muted text-[11px]">{fmtDateTime(e.t!)} · {dayjs(e.t!).fromNow()}</p>
                </li>
              ))}
            {ticket.status !== 'resolved' && (
              <li className="relative">
                <span className="absolute top-1 -left-[21.5px] h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                <p className="text-xs font-semibold">Still {ticket.status.replace(/_/g, ' ')}</p>
                <p className="muted text-[11px]">Due {fmtDateTime(new Date(Date.parse(ticket.createdAt) + ticket.slaHours * 3_600_000))}</p>
              </li>
            )}
          </ol>
          <Button variant="primary" size="md" className="w-full" onClick={() => { onClose(); }}>
            Mark handled (demo action)
          </Button>
        </div>
      )}
    </Sheet>
  )
}
