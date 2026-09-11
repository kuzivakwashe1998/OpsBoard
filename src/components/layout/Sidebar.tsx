import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Database, Radio } from 'lucide-react'
import { NAV } from './nav'
import { cn } from '../../lib/cn'
import { useStore } from '../../state/store'
import { getDataset } from '../../data/dataset'
import { fmtInt } from '../../lib/format'
import { Badge, StatusDot } from '../ui/primitives'
import { Modal } from '../ui/Sheet'

function NavLinks({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const groups = ['Operate', 'Grow', 'Report'] as const
  return (
    <nav aria-label="Primary" className={cn('space-y-5', compact && 'px-0')}>
      {groups.map((g) => (
        <div key={g}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase dark:text-slate-500">{g}</p>
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.group === g).map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                      isActive
                        ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'font-medium text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={2.1} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function DataStatusCard() {
  const ds = getDataset()
  const live = useStore((s) => s.live)
  const toggleLive = useStore((s) => s.toggleLive)
  const [aboutOpen, setAboutOpen] = useState(false)
  const rows = ds.daily.length + ds.orders.length + ds.tickets.length + ds.skus.length + ds.customers.length

  return (
    <>
      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        className="card w-full px-3.5 py-3 text-left transition-shadow hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            <Database className="h-3.5 w-3.5" /> Data status
          </span>
          <Badge tone={live ? 'emerald' : 'neutral'} dot>
            {live ? 'live' : 'static'}
          </Badge>
        </div>
        <dl className="mt-2 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <dt className="muted">Coverage</dt>
            <dd className="tnum font-medium">{ds.startDay.slice(0, 7)} → {ds.today}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Records</dt>
            <dd className="tnum font-medium">{fmtInt(rows)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Seed</dt>
            <dd className="font-mono font-medium">{ds.seed}</dd>
          </div>
        </dl>
      </button>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={toggleLive}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
            live
              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
              : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          <StatusDot tone={live ? 'emerald' : 'slate'} pulse={live} />
          <Radio className="h-3 w-3" />
          {live ? 'Pause live mode' : 'Simulate live'}
        </button>
      </div>

      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="About this dataset" wide>
        <div className="space-y-3 text-[13px] leading-relaxed">
          <p className="muted text-xs">
            OpsBoard ships with a fully synthetic but realistic business simulator so the dashboard is useful out of the box. Swap{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px] dark:bg-slate-800">src/data/dataset.ts</code> to point
            at a real warehouse.
          </p>
          <ul className="muted list-disc space-y-1.5 pl-5 text-xs">
            <li>
              <b className="text-slate-700 dark:text-slate-200">{fmtInt(ds.daily.length)}</b> daily region×channel aggregates over two years, generated with
              weekday seasonality, growth trends, quarter-end pushes, marketing campaigns and service disruptions.
            </li>
            <li>
              <b className="text-slate-700 dark:text-slate-200">{fmtInt(ds.orders.length)}</b> order detail records (last 91 days) with items, carriers and promise-date math.
            </li>
            <li>
              <b className="text-slate-700 dark:text-slate-200">{fmtInt(ds.tickets.length)}</b> support tickets with first-response and SLA timelines.
            </li>
            <li>
              <b className="text-slate-700 dark:text-slate-200">{ds.skus.length}</b> SKUs across 5 warehouses, with demand-driven days-of-cover and replenishment math.
            </li>
            <li>
              Everything is <b className="text-slate-700 dark:text-slate-200">deterministic</b>: seed <code className="font-mono">{ds.seed}</code> always produces the same business history, so charts are stable between reloads.
            </li>
            <li>
              <b className="text-slate-700 dark:text-slate-200">Live mode</b> streams simulated events and patches today&rsquo;s aggregates without touching the historical baseline.
            </li>
          </ul>
        </div>
      </Modal>
    </>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const live = useStore((s) => s.live)
  return (
    <div className="flex h-full flex-col gap-4 px-3 py-4">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
          <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
            <rect x="6" y="16" width="5" height="10" rx="1.6" fill="white" />
            <rect x="13.5" y="8" width="5" height="18" rx="1.6" fill="white" opacity=".86" />
            <rect x="21" y="12" width="5" height="14" rx="1.6" fill="white" opacity=".7" />
          </svg>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
            OpsBoard
            {live && <StatusDot tone="emerald" pulse />}
          </div>
          <div className="muted text-[10px] font-medium">Business operations, at a glance</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks onNavigate={onNavigate} />
      </div>

      <DataStatusCard />
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200/80 bg-white/70 backdrop-blur lg:block dark:border-slate-800 dark:bg-slate-900/60">
      <SidebarContent />
    </aside>
  )
}
