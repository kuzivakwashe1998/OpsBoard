import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtInt, fmtPct } from '../../lib/format'
import { useChartTheme } from './chartTheme'

export interface RegionDatum {
  region: string
  onTimePct: number
  prevOnTimePct: number
  late: number
  orders: number
}

function Tip({ active, payload }: any) {
  const theme = useChartTheme()
  if (!active || !payload?.length) return null
  const d: RegionDatum = payload[0].payload
  return (
    <div
      className="rounded-lg px-3 py-2 text-[11px] shadow-xl"
      style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}` }}
    >
      <div className="mb-0.5 font-semibold">{d.region}</div>
      <div className="tnum">On-time {fmtPct(d.onTimePct)}</div>
      <div className="muted tnum">{fmtInt(d.late)} late of {fmtInt(d.orders)} orders</div>
      {d.prevOnTimePct > 0 && (
        <div className="muted tnum">prev {fmtPct(d.prevOnTimePct)}</div>
      )}
    </div>
  )
}

const colorFor = (v: number) => (v >= 94 ? '#059669' : v >= 90 ? '#d97706' : '#e11d48')

export function RegionBars({ data, height = 220, target = 94 }: { data: RegionDatum[]; height?: number; target?: number }) {
  const theme = useChartTheme()
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -14 }} barCategoryGap="28%">
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="region"
            tick={{ fontSize: 10, fill: theme.muted }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
            interval={0}
            tickFormatter={(v: string) => (v === 'North America' ? 'N. America' : v)}
          />
          <YAxis
            domain={[60, 100]}
            tick={{ fontSize: 10.5, fill: theme.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={(p: any) => <Tip {...p} />} />
          <ReferenceLine y={target} stroke="#0284c7" strokeDasharray="4 4" label={{ value: `target ${target}%`, position: 'insideTopRight', fontSize: 9, fill: '#0284c7' }} />
          <Bar dataKey="onTimePct" radius={[5, 5, 2, 2]} animationDuration={500}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d.onTimePct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Horizontal ranking bars (reps, agents…) — pure DOM, prints cleanly. */
export function Leaderboard({
  rows,
  valueFmt,
  rightLabel,
}: {
  rows: { name: string; sub?: string; value: number; pct?: number; tone?: 'emerald' | 'amber' | 'rose' | 'sky' }[]
  valueFmt: (n: number) => string
  rightLabel?: string
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1)
  const toneClass = {
    emerald: 'bg-emerald-500/80',
    amber: 'bg-amber-500/80',
    rose: 'bg-rose-500/80',
    sky: 'bg-sky-500/80',
  } as const
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.name} className="group">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="tnum muted w-4 shrink-0 text-right text-[10px] font-semibold">{i + 1}</span>
              <span className="truncate font-medium">{r.name}</span>
              {r.sub && <span className="muted hidden truncate text-[10.5px] sm:inline">· {r.sub}</span>}
            </span>
            <span className="tnum shrink-0 font-semibold">
              {valueFmt(r.value)}
              {r.pct !== undefined && (
                <span className={r.pct >= 100 ? 'ml-1.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400' : r.pct >= 85 ? 'ml-1.5 text-[10.5px] font-medium text-amber-600 dark:text-amber-400' : 'ml-1.5 text-[10.5px] font-medium text-rose-600 dark:text-rose-400'}>
                  {r.pct.toFixed(0)}%
                </span>
              )}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 group-hover:bg-slate-200/80 dark:bg-slate-800 dark:group-hover:bg-slate-700">
            <div
              className={`h-full rounded-full ${toneClass[r.tone ?? (r.pct === undefined ? 'sky' : r.pct >= 100 ? 'emerald' : r.pct >= 85 ? 'amber' : 'rose')]}`}
              style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {rightLabel && <li className="muted pt-1 text-right text-[10px]">{rightLabel}</li>}
    </ul>
  )
}
