import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max })

/** 1234 → "1,234" */
export function fmtInt(n: number): string {
  return nf(0, 0).format(Math.round(n))
}

export function fmtDecimal(n: number, digits = 1): string {
  return nf(digits, digits).format(n)
}

/** Compact money: 12.4M, $842K, $1,204 */
export function fmtMoney(n: number, compact = true): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (compact) {
    if (abs >= 1e9) return `${sign}$${nf(abs >= 1e10 ? 0 : 1, abs >= 1e10 ? 0 : 1).format(abs / 1e9)}B`
    if (abs >= 1e6) return `${sign}$${nf(2, 2).format(abs / 1e6)}M`
    if (abs >= 1e4) return `${sign}$${nf(1, 1).format(abs / 1e3)}K`
  }
  return `${sign}$${nf(0, 0).format(abs)}`
}

/** Exact cents money: $1,234.56 */
export function fmtMoney2(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${nf(2, 2).format(Math.abs(n))}`
}

export function fmtPct(p: number, digits = 1): string {
  return `${nf(digits, digits).format(p)}%`
}

/** Percentage-point delta, always signed: "+2.1 pp" */
export function fmtPp(p: number, digits = 1): string {
  const v = nf(digits, digits).format(Math.abs(p))
  return `${p >= 0 ? '+' : '-'}${v} pp`
}

/** Relative delta like "+12.4%" — null when no prior baseline. */
export function fmtDeltaPct(d: number | null | undefined, digits = 1): string {
  if (d === null || d === undefined || !Number.isFinite(d)) return '—'
  return `${d >= 0 ? '+' : ''}${nf(digits, digits).format(d)}%`
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${nf(1, 1).format(n / 1e9)}B`
  if (abs >= 1e6) return `${nf(1, 1).format(n / 1e6)}M`
  if (abs >= 1e3) return `${nf(1, 1).format(n / 1e3)}K`
  return nf(0, 0).format(n)
}

/** Minutes → "42m" / "3h 08m" / "1d 6h" */
export function fmtDurationMin(min: number): string {
  if (!Number.isFinite(min)) return '—'
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h < 24) return `${h}h ${String(m).padStart(2, '0')}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export function fmtHours(h: number): string {
  return fmtDurationMin(h * 60)
}

export function fmtDay(d: dayjs.ConfigType, style: 'short' | 'medium' | 'weekday' = 'short'): string {
  if (style === 'medium') return dayjs(d).format('MMM D, YYYY')
  if (style === 'weekday') return dayjs(d).format('ddd, MMM D')
  return dayjs(d).format('MMM D')
}

export function fmtDateTime(d: dayjs.ConfigType): string {
  return dayjs(d).format('MMM D, h:mm A')
}

export function fmtTime(d: dayjs.ConfigType): string {
  return dayjs(d).format('h:mm A')
}

export function fmtRelative(d: dayjs.ConfigType): string {
  return dayjs(d).fromNow()
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export const titleCase = (s: string): string =>
  s
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
