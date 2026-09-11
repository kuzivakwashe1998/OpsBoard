import { useMemo } from 'react'
import { DAYS_LTR } from '../../lib/dates'
import { cn } from '../../lib/cn'

/**
 * Volume heatmap: weekday × hour. Pure divs with an interpolated color
 * scale — cheap to render, prints fine, and no chart-lib dependency.
 */
export function Heatmap({
  grid,
  maxLabel = 'peak',
  className,
}: {
  grid: number[][] // 7 rows (Mon..Sun) × 24 cols
  maxLabel?: string
  className?: string
}) {
  const { max, cells } = useMemo(() => {
    let m = 1
    for (const row of grid) for (const v of row) m = Math.max(m, v)
    return { max: m, cells: grid }
  }, [grid])

  const color = (v: number): string => {
    if (v === 0) return 'var(--hm-empty)'
    const t = Math.min(1, v / max)
    // slate → emerald → amber ramp by intensity
    if (t < 0.34) return `rgba(16,185,129,${0.15 + t * 1.2})`
    if (t < 0.67) return `rgba(16,185,129,${0.45 + (t - 0.34) * 1.4})`
    return `rgba(245,158,11,${0.55 + (t - 0.67) * 1.3})`
  }

  return (
    <div className={cn('print-avoid-break', className)} style={{ ['--hm-empty' as string]: 'rgba(148,163,184,0.10)' }}>
      <div className="grid grid-cols-[2.2rem_1fr] gap-x-2 gap-y-[3px]">
        {cells.map((row, ri) => (
          <div key={ri} className="contents">
            <div className="muted flex items-center justify-end pr-1 text-[9.5px] font-medium">{DAYS_LTR[ri]}</div>
            <div className="grid grid-cols-24 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {row.map((v, ci) => (
                <div
                  key={ci}
                  title={`${DAYS_LTR[ri]} ${String(ci).padStart(2, '0')}:00 — ${v} ticket${v === 1 ? '' : 's'}`}
                  className="aspect-square min-w-0 cursor-default rounded-[3px] transition-transform hover:scale-125"
                  style={{ background: color(v), outline: v > max * 0.9 ? '1px solid rgba(217,119,6,.8)' : undefined }}
                />
              ))}
            </div>
          </div>
        ))}
        <div />
        <div className="mt-1 flex items-center justify-between">
          <div className="muted flex gap-3 text-[9.5px]">
            {[0, 4, 8, 12, 16, 20].map((h) => (
              <span key={h}>{String(h).padStart(2, '0')}</span>
            ))}
          </div>
          <div className="muted flex items-center gap-1 text-[9.5px]">
            <span>low</span>
            {[0.15, 0.4, 0.65, 0.9].map((t, i) => (
              <span key={i} className="h-2 w-2 rounded-[2px]" style={{ background: color(max * t) }} />
            ))}
            <span>{maxLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
