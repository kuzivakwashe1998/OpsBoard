import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { fmtDeltaPct, fmtDurationMin, fmtInt, fmtMoney, fmtPct, fmtPp } from '../../lib/format'
import type { Kpi } from '../../metrics/kpis'
import { Sparkline } from './Sparkline'
import { StatusDot, type Tone } from './primitives'

const STATUS_TONE: Record<string, Tone> = { ok: 'emerald', watch: 'amber', risk: 'rose' }

export function formatKpiValue(v: number, format: Kpi['def']['format']): string {
  if (!Number.isFinite(v)) return '—'
  switch (format) {
    case 'money':
      return fmtMoney(v)
    case 'int':
      return fmtInt(v)
    case 'pct':
      return fmtPct(v, Math.abs(v) >= 100 ? 0 : 1)
    case 'minutes':
      return fmtDurationMin(v)
  }
}

export function formatKpiDelta(kpi: Kpi): string {
  if (kpi.delta === null) return 'new'
  return kpi.def.deltaMode === 'pp' ? fmtPp(kpi.delta) : fmtDeltaPct(kpi.delta)
}

export function StatCard({
  kpi,
  compareLabel,
  className,
  leading,
  onClick,
}: {
  kpi: Kpi
  compareLabel?: string
  className?: string
  leading?: ReactNode
  onClick?: () => void
}) {
  const goodDir = kpi.delta === null ? null : kpi.delta > 0 === kpi.def.goodWhenUp ? true : kpi.delta < 0 === kpi.def.goodWhenUp ? false : null
  const Arrow = kpi.delta === null || kpi.delta === 0 ? Minus : kpi.delta > 0 ? ArrowUpRight : ArrowDownRight
  const deltaColor =
    kpi.delta === null || kpi.delta === 0
      ? 'muted'
      : goodDir
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400'

  return (
    <div
      className={cn(
        'card group relative flex flex-col gap-2 px-4 pt-3.5 pb-3 transition-shadow',
        onClick && 'cursor-pointer hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      title={kpi.def.tip}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {leading}
          {kpi.def.label}
        </span>
        {kpi.status && <StatusDot tone={STATUS_TONE[kpi.status]} />}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="tnum text-2xl leading-8 font-semibold tracking-tight">{formatKpiValue(kpi.value, kpi.def.format)}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium">
            <span className={cn('tnum inline-flex items-center gap-0.5', deltaColor)}>
              <Arrow className="h-3 w-3" strokeWidth={2.4} />
              {formatKpiDelta(kpi)}
            </span>
            <span className="muted truncate text-[10.5px] font-normal">{compareLabel ?? 'vs prior period'}</span>
          </div>
        </div>
        <div className="w-24 shrink-0 self-stretch opacity-90">
          <Sparkline data={kpi.spark} tone={kpi.def.goodWhenUp ? 'emerald' : (kpi.delta ?? 0) > 0 ? 'rose' : 'sky'} />
        </div>
      </div>
    </div>
  )
}
