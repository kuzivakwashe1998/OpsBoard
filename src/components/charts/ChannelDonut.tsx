import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fmtMoney, fmtPct } from '../../lib/format'
import { PALETTE, useChartTheme } from './chartTheme'

export interface DonutDatum {
  name: string
  value: number
  orders: number
  prevValue: number
}

function TipContent({ active, payload }: any) {
  const theme = useChartTheme()
  if (!active || !payload?.length) return null
  const d: DonutDatum = payload[0].payload
  const total = payload[0].payload.__total ?? 0
  return (
    <div
      className="rounded-lg px-3 py-2 text-[11px] shadow-xl"
      style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}` }}
    >
      <div className="mb-0.5 font-semibold">{d.name}</div>
      <div className="tnum">{fmtMoney(d.value)}</div>
      {total > 0 && <div className="muted">{fmtPct((d.value / total) * 100)} of mix</div>}
      <div className="muted">{d.orders.toLocaleString()} orders</div>
    </div>
  )
}

export function ChannelDonut({ data, height = 220 }: { data: DonutDatum[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const withTotal = data.map((d) => ({ ...d, __total: total }))
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row">
      <div style={{ height, width: height }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={withTotal as any}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="94%"
              paddingAngle={2.5}
              cornerRadius={3}
              strokeWidth={0}
              animationDuration={500}
            >
              {withTotal.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={(p: any) => <TipContent {...p} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] font-semibold tracking-wide text-slate-400 uppercase">Total</span>
          <span className="tnum text-sm font-semibold">{fmtMoney(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => {
          const delta = d.prevValue > 0 ? ((d.value - d.prevValue) / d.prevValue) * 100 : null
          return (
            <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="truncate font-medium">{d.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="tnum muted hidden sm:inline">{fmtPct(total ? (d.value / total) * 100 : 0, 0)}</span>
                <span className="tnum font-semibold">{fmtMoney(d.value)}</span>
                {delta !== null && (
                  <span className={delta >= 0 ? 'tnum w-14 text-right text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400' : 'tnum w-14 text-right text-[10.5px] font-medium text-rose-600 dark:text-rose-400'}>
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}%
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
