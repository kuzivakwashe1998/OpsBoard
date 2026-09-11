import { cn } from '../../lib/cn'

/** CSS conic-gradient donut gauge — crisp, printable, zero dependencies. */
export function Gauge({
  value,
  size = 96,
  label,
  sublabel,
  tone = 'emerald',
}: {
  value: number // 0..100
  size?: number
  label?: string
  sublabel?: string
  tone?: 'emerald' | 'amber' | 'rose' | 'sky'
}) {
  const v = Math.max(0, Math.min(100, value))
  const stroke = 9
  const colors = {
    emerald: ['#059669', 'rgba(5,150,105,.14)'],
    amber: ['#d97706', 'rgba(217,119,6,.14)'],
    rose: ['#e11d48', 'rgba(225,29,72,.14)'],
    sky: ['#0284c7', 'rgba(2,132,199,.14)'],
  } as const
  const [fg, bg] = colors[tone]
  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full print-avoid-break')}
      style={{ width: size, height: size, background: `conic-gradient(${fg} ${v * 3.6}deg, ${bg} 0deg)` }}
      role="img"
      aria-label={`${label ?? 'gauge'}: ${v.toFixed(1)}%`}
    >
      <div
        className="absolute rounded-full bg-white dark:bg-slate-900"
        style={{ inset: stroke }}
      />
      <div className="relative z-10 flex flex-col items-center leading-none">
        <span className="tnum text-base font-semibold tracking-tight" style={{ fontSize: size / 6 }}>
          {label ?? `${v.toFixed(0)}%`}
        </span>
        {sublabel && <span className="muted mt-0.5 text-[9px] font-medium uppercase tracking-wide">{sublabel}</span>}
      </div>
    </div>
  )
}
