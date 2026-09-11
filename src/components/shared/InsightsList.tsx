import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Info, TrendingDown, TrendingUp } from 'lucide-react'
import type { Insight, InsightSeverity } from '../../metrics/insights'
import { cn } from '../../lib/cn'

const META: Record<InsightSeverity, { icon: typeof Info; ring: string; iconColor: string }> = {
  critical: { icon: AlertTriangle, ring: 'border-rose-200 bg-rose-50/70 dark:border-rose-500/25 dark:bg-rose-500/[0.06]', iconColor: 'text-rose-600 dark:text-rose-400' },
  warning: { icon: TrendingDown, ring: 'border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/[0.06]', iconColor: 'text-amber-600 dark:text-amber-400' },
  positive: { icon: TrendingUp, ring: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-500/[0.06]', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  info: { icon: Info, ring: 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40', iconColor: 'text-slate-500 dark:text-slate-400' },
}

export function InsightsList({ insights, dense }: { insights: Insight[]; dense?: boolean }) {
  const navigate = useNavigate()
  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-xs dark:border-emerald-500/25 dark:bg-emerald-500/[0.06]">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span>No exceptions to flag for this window.</span>
      </div>
    )
  }
  return (
    <ul className={cn('space-y-2', dense && 'space-y-1.5')}>
      {insights.map((it) => {
        const m = META[it.severity]
        const Icon = m.icon
        return (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => it.link && navigate(it.link)}
              className={cn(
                'group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-shadow hover:shadow-sm',
                m.ring,
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', m.iconColor)} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-snug font-semibold">{it.title}</span>
                <span className="muted mt-0.5 block text-[11px] leading-relaxed">{it.body}</span>
              </span>
              {it.link && (
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600" />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
