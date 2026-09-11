import { RotateCcw } from 'lucide-react'
import { RANGE_PRESETS, isoDay } from '../../lib/dates'
import { useStore } from '../../state/store'
import { Button, Select, TextInput, Toggle } from '../ui/primitives'
import { getDataset } from '../../data/dataset'
import { CHANNELS, REGIONS, type Channel, type Region } from '../../data/model'
import { fmtDay } from '../../lib/format'
import { useRangeInfo } from '../../data/selectors'

const PRESET_OPTS = RANGE_PRESETS.map((p) => ({ value: p.id, label: p.label, title: p.days ? `Last ${p.days} days` : p.label === 'YTD' ? 'Year to date' : 'Full history' }))

export function FilterBar() {
  const ds = getDataset()
  const preset = useStore((s) => s.preset)
  const customRange = useStore((s) => s.customRange)
  const setPreset = useStore((s) => s.setPreset)
  const setCustomRange = useStore((s) => s.setCustomRange)
  const region = useStore((s) => s.region)
  const channel = useStore((s) => s.channel)
  const setRegion = useStore((s) => s.setRegion)
  const setChannel = useStore((s) => s.setChannel)
  const compare = useStore((s) => s.compare)
  const setCompare = useStore((s) => s.setCompare)
  const resetView = useStore((s) => s.resetView)
  const { range, prevRange, days } = useRangeInfo()

  const isCustom = preset === 'custom'

  return (
    <div className="no-print sticky top-14 z-20 border-b border-slate-200/80 bg-slate-100/85 px-4 py-2.5 backdrop-blur lg:px-6 dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Preset picker */}
        <div role="group" aria-label="Date range" className="flex items-center gap-0.5 rounded-lg border border-slate-300/80 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {PRESET_OPTS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.title}
              onClick={() => {
                setPreset(p.value)
                if (p.value !== 'custom') setCustomRange(null)
              }}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                preset === p.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            title="Custom range"
            onClick={() =>
              isCustom
                ? (setPreset('30d'), setCustomRange(null))
                : (setPreset('custom'),
                   setCustomRange(customRange ?? { start: ds.startDay, end: ds.today }))
            }
            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              isCustom ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            …
          </button>
        </div>

        {isCustom && (
          <div className="flex items-center gap-1.5">
            <TextInput
              type="date"
              aria-label="Start date"
              max={ds.today}
              value={customRange?.start ?? isoDay()}
              onChange={(e) => setCustomRange({ start: e.target.value, end: customRange?.end ?? ds.today })}
            />
            <span className="muted text-xs">→</span>
            <TextInput
              type="date"
              aria-label="End date"
              min={customRange?.start}
              max={ds.today}
              value={customRange?.end ?? ds.today}
              onChange={(e) => setCustomRange({ start: customRange?.start ?? ds.startDay, end: e.target.value })}
            />
          </div>
        )}

        <div className="mx-1 hidden h-5 w-px bg-slate-300/70 sm:block dark:bg-slate-700" />

        <Select
          aria-label="Filter by region"
          className="w-36"
          value={region}
          onChange={(e) => setRegion(e.target.value as Region | 'all')}
          options={[{ value: 'all', label: 'All regions' }, ...REGIONS.map((r) => ({ value: r, label: r }))]}
        />
        <Select
          aria-label="Filter by channel"
          className="w-32"
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel | 'all')}
          options={[{ value: 'all', label: 'All channels' }, ...CHANNELS.map((c) => ({ value: c, label: c }))]}
        />

        <div className="ml-auto flex items-center gap-3">
          <Toggle checked={compare} onChange={setCompare} label="Compare to previous period" />
          <span className="muted hidden text-[11px] font-medium lg:inline" title="Active comparison basis">
            {days}d: {fmtDay(range.start)} – {fmtDay(range.end)}
            {compare && <span className="text-slate-400 dark:text-slate-500"> · vs {fmtDay(prevRange.start)} – {fmtDay(prevRange.end)}</span>}
          </span>
          <Button variant="ghost" size="xs" onClick={resetView} title="Reset all filters">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>
    </div>
  )
}
