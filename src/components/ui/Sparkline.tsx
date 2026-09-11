import { useId, useMemo } from 'react'
import { cn } from '../../lib/cn'

interface SparklineProps {
  data: number[]
  tone?: 'emerald' | 'rose' | 'amber' | 'sky' | 'slate' | 'violet'
  height?: number
  className?: string
  invert?: boolean // color by "bad when up" metrics
}

const TONE_HEX: Record<NonNullable<SparklineProps['tone']>, string> = {
  emerald: '#059669',
  rose: '#e11d48',
  amber: '#d97706',
  sky: '#0284c7',
  slate: '#64748b',
  violet: '#7c3aed',
}

/** Dependency-free SVG sparkline with soft area fill and an end dot. */
export function Sparkline({ data, tone = 'emerald', height = 36, className, invert }: SparklineProps) {
  const gid = useId().replace(/:/g, '')
  const W = 160
  const H = height

  const { line, area, lastX, lastY } = useMemo(() => {
    const pts = data.filter((n) => Number.isFinite(n))
    if (pts.length < 2) return { line: '', area: '', lastX: 0, lastY: 0 }
    const min = Math.min(...pts)
    const max = Math.max(...pts)
    const span = max - min || 1
    const step = W / (pts.length - 1)
    const coords = pts.map((v, i) => [i * step, H - 3 - ((v - min) / span) * (H - 7)] as const)
    const lineStr = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
    const areaStr = `${lineStr}L${W},${H}L0,${H}Z`
    const [lx, ly] = coords[coords.length - 1]
    return { line: lineStr, area: areaStr, lastX: lx, lastY: ly }
  }, [data, H])

  const color = TONE_HEX[invert ? (tone === 'emerald' ? 'rose' : 'emerald') : tone]

  if (!line) {
    return <div className={cn('flex h-9 items-center text-[10px] text-slate-400', className)}>not enough data</div>
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn('block w-full', className)}
      style={{ height }}
      role="img"
      aria-label="trend sparkline"
    >
      <defs>
        <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="2.4" fill={color} />
    </svg>
  )
}
