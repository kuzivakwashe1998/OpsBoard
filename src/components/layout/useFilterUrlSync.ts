/**
 * Two-way sync between the global filters and the URL query string, so any
 * dashboard view is deep-linkable (e.g. /orders?range=90d&region=EMEA).
 * Only non-default values hit the URL; unrelated params (like ?focus=) are
 * preserved.
 */
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../../state/store'
import type { Channel, Region } from '../../data/model'
import type { DayRange } from '../../lib/dates'
import { REGIONS, CHANNELS } from '../../data/model'

const FILTER_KEYS = ['range', 'region', 'channel', 'cmp', 'start', 'end']

export function useFilterUrlSync() {
  const [params, setParams] = useSearchParams()
  const hydrated = useRef(false)

  const preset = useStore((s) => s.preset)
  const customRange = useStore((s) => s.customRange)
  const region = useStore((s) => s.region)
  const channel = useStore((s) => s.channel)
  const compare = useStore((s) => s.compare)
  const store = useStore.getState

  // URL → store, exactly once on mount
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const s = store()
    const p = params.get('range')
    if (p) s.setPreset(p === 'custom' ? 'custom' : p)
    if (p === 'custom' || params.get('start')) {
      const start = params.get('start')
      const end = params.get('end')
      if (start && end) s.setCustomRange({ start, end })
    }
    const rg = params.get('region')
    if (rg && (rg === 'all' || (REGIONS as readonly string[]).includes(rg))) s.setRegion(rg as Region | 'all')
    const ch = params.get('channel')
    if (ch && (ch === 'all' || (CHANNELS as readonly string[]).includes(ch))) s.setChannel(ch as Channel | 'all')
    const cmp = params.get('cmp')
    if (cmp !== null) s.setCompare(cmp === '1')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // store → URL on every change
  useEffect(() => {
    if (!hydrated.current) return
    const next = new URLSearchParams(params)
    for (const k of FILTER_KEYS) next.delete(k)
    if (preset !== '30d') next.set('range', preset)
    if (preset === 'custom' && customRange) {
      next.set('start', customRange.start as DayRange['start'])
      next.set('end', customRange.end)
    }
    if (region !== 'all') next.set('region', region)
    if (channel !== 'all') next.set('channel', channel)
    if (!compare) next.set('cmp', '0')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customRange, region, channel, compare])
}
