import dayjs from 'dayjs'

export type Granularity = 'day' | 'week' | 'month'

/** Inclusive ISO-day range { yyyy-mm-dd } */
export interface DayRange {
  start: string
  end: string
}

export interface RangePreset {
  id: string
  label: string
  days?: number
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: '6m', label: '6M', days: 182 },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All' },
]

export const isoDay = (d: dayjs.ConfigType = new Date()): string => dayjs(d).format('YYYY-MM-DD')

export const addDaysISO = (iso: string, n: number): string => dayjs(iso).add(n, 'day').format('YYYY-MM-DD')

export function rangeLength(r: DayRange): number {
  return dayjs(r.end).diff(dayjs(r.start), 'day') + 1
}

/** ISO strings compare lexicographically, which keeps range filters cheap. */
export const inRange = (day: string, r: DayRange): boolean => day >= r.start && day <= r.end

export function resolveRange(
  presetId: string,
  custom: DayRange | null,
  earliestDay: string,
  today: string,
): DayRange {
  if (presetId === 'custom' && custom) {
    const start = custom.start < earliestDay ? earliestDay : custom.start
    const end = custom.end > today ? today : custom.end
    return start <= end ? { start, end } : { start: end, end: start }
  }
  const t = dayjs(today)
  if (presetId === 'ytd') return { start: t.startOf('year').format('YYYY-MM-DD'), end: today }
  if (presetId === 'all') return { start: earliestDay, end: today }
  const preset = RANGE_PRESETS.find((p) => p.id === presetId) ?? RANGE_PRESETS[1]
  const start = t.subtract((preset.days ?? 30) - 1, 'day').format('YYYY-MM-DD')
  const clamped = start < earliestDay ? earliestDay : start
  return { start: clamped, end: today }
}

/** The immediately preceding window of the same length. */
export function previousRange(r: DayRange): DayRange {
  const len = rangeLength(r)
  const end = addDaysISO(r.start, -1)
  const start = addDaysISO(end, -(len - 1))
  return { start, end }
}

export function granularityFor(days: number): Granularity {
  if (days <= 92) return 'day'
  if (days <= 366) return 'week'
  return 'month'
}

/** Monday-anchored week key. */
export function mondayOf(iso: string): string {
  const d = dayjs(iso)
  const dow = (d.day() + 6) % 7 // 0 = Monday
  return d.subtract(dow, 'day').format('YYYY-MM-DD')
}

export function bucketKey(iso: string, g: Granularity): string {
  if (g === 'week') return mondayOf(iso)
  if (g === 'month') return iso.slice(0, 7) + '-01'
  return iso
}

export function bucketLabel(key: string, g: Granularity): string {
  if (g === 'month') return dayjs(key).format('MMM ’YY')
  return dayjs(key).format('MMM D')
}

export const DAYS_LTR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
