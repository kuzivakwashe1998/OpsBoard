import { fmtInt, fmtPct } from '../../lib/format'
import { cn } from '../../lib/cn'

export interface FunnelStage {
  label: string
  value: number
  tone?: 'emerald' | 'sky' | 'amber' | 'rose'
  note?: string
}

const TONE_BG: Record<NonNullable<FunnelStage['tone']>, string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  sky: 'bg-gradient-to-r from-sky-500 to-sky-400',
  amber: 'bg-gradient-to-r from-amber-500 to-amber-400',
  rose: 'bg-gradient-to-r from-rose-500 to-rose-400',
}

/** Fulfillment funnel — DOM bars, big-to-small, with stage conversion. */
export function Funnel({ stages, className }: { stages: FunnelStage[]; className?: string }) {
  const max = stages[0]?.value || 1
  return (
    <div className={cn('space-y-2.5 print-avoid-break', className)}>
      {stages.map((s, i) => {
        const width = (s.value / max) * 100
        const conv = i === 0 ? 100 : stages[i - 1].value ? (s.value / stages[i - 1].value) * 100 : 0
        const drop = i > 0 && conv < 92
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">
                {s.label}
                {s.note && <span className="muted ml-1.5 text-[10.5px] font-normal">{s.note}</span>}
              </span>
              <span className="tnum flex items-baseline gap-2">
                <span className="font-semibold">{fmtInt(s.value)}</span>
                {i > 0 && (
                  <span className={cn('text-[10.5px] font-medium', drop ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}>
                    {fmtPct(conv, 0)}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full rounded-md bg-slate-100 dark:bg-slate-800">
              <div className={cn('h-full rounded-md transition-all duration-500', TONE_BG[s.tone ?? 'emerald'])} style={{ width: `${Math.max(1.5, width)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
