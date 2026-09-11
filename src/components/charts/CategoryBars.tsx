import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMoney } from '../../lib/format'
import { useChartTheme } from './chartTheme'

export interface CategoryDatum {
  category: string
  value: number
  atRisk: number
}

function Tip({ active, payload }: any) {
  const theme = useChartTheme()
  if (!active || !payload?.length) return null
  const d: CategoryDatum = payload[0].payload
  return (
    <div
      className="rounded-lg px-3 py-2 text-[11px] shadow-xl"
      style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}` }}
    >
      <div className="mb-0.5 font-semibold">{d.category}</div>
      <div className="tnum">{fmtMoney(d.value)} on hand</div>
      {d.atRisk > 0 && <div className="tnum text-amber-600 dark:text-amber-400">{fmtMoney(d.atRisk)} at risk</div>}
    </div>
  )
}

/** Inventory $ by category, with at-risk overlay. */
export function CategoryBars({ data, height = 240 }: { data: CategoryDatum[]; height?: number }) {
  const theme = useChartTheme()
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 6, bottom: 0, left: -8 }} barCategoryGap="26%">
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 9.5, fill: theme.muted }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
            interval={0}
            tickFormatter={(v: string) => v.split(' ')[0]}
          />
          <YAxis tick={{ fontSize: 10.5, fill: theme.muted }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtMoney(v)} />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={(p: any) => <Tip {...p} />} />
          <Bar dataKey="value" stackId="a" fill="#059669" fillOpacity={0.85} radius={[0, 0, 3, 3]}>
            <LabelList dataKey="value" position="top" formatter={(v: any) => fmtMoney(Number(v))} style={{ fontSize: 9, fill: theme.muted }} />
          </Bar>
          <Bar dataKey="atRisk" stackId="a" fill="#d97706" fillOpacity={0.9} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
