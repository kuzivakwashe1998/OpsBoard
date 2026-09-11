import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '../../metrics/kpis'
import { fmtInt, fmtMoney } from '../../lib/format'
import { useChartTheme } from './chartTheme'

interface Props {
  data: TrendPoint[]
  height?: number
  showPrev: boolean
  metric: 'revenue' | 'volume'
  planLine?: number
}

interface TipProps {
  active?: boolean
  payload?: { payload: TrendPoint }[]
  label?: string
  showPrev: boolean
  metric: Props['metric']
  plan?: number
}

function TrendTip({ active, payload, label, showPrev, metric, plan }: TipProps) {
  const theme = useChartTheme()
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div
      className="rounded-lg px-3 py-2 text-[11px] shadow-xl backdrop-blur"
      style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}` }}
    >
      <div className="mb-1 font-semibold">{label}</div>
      <Row color="#059669" name="Revenue" value={fmtMoney(p.revenue)} />
      {metric === 'volume' && <Row color="#7c3aed" name="Orders" value={fmtInt(p.orders)} />}
      {metric === 'revenue' && showPrev && p.prevRevenue > 0 && <Row color="#94a3b8" name="Prev period" value={fmtMoney(p.prevRevenue)} />}
      {metric === 'revenue' && plan !== undefined && plan > 0 && <Row color="#0284c7" name="Plan" value={fmtMoney(plan)} />}
      <Row color="#d97706" name="Gross margin" value={`${p.grossMarginPct.toFixed(1)}%`} />
    </div>
  )
}

function Row({ color, name, value }: { color: string; name: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 leading-5">
      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
        {name}
      </span>
      <span className="tnum font-medium">{value}</span>
    </div>
  )
}

/** Revenue (area) vs cost & orders with plan reference line. */
export function TrendChart({ data, height = 260, showPrev, metric, planLine }: Props) {
  const theme = useChartTheme()
  const totalPlan = planLine
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#0284c7" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10.5, fill: theme.muted }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={26}
          />
          <YAxis
            yAxisId="money"
            tick={{ fontSize: 10.5, fill: theme.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => fmtMoney(v)}
            width={52}
          />
          {metric === 'volume' && (
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={{ fontSize: 10.5, fill: theme.muted }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
          )}
          <Tooltip
            cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
            content={(p: any) => <TrendTip {...(p as object)} showPrev={showPrev} metric={metric} plan={totalPlan} />}
          />
          <Area
            yAxisId="money"
            type="monotone"
            dataKey="revenue"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#revFill)"
            animationDuration={500}
          />
          {metric === 'revenue' && showPrev && (
            <Line
              yAxisId="money"
              type="monotone"
              dataKey="prevRevenue"
              stroke={theme.axis}
              strokeWidth={1.4}
              strokeDasharray="5 4"
              dot={false}
              name="Prev period"
            />
          )}
          {metric === 'revenue' && (
            <Area yAxisId="money" type="monotone" dataKey="cost" stroke="#0284c7" strokeWidth={1.2} fill="url(#costFill)" name="Total cost" />
          )}
          {totalPlan !== undefined && totalPlan > 0 && (
            <ReferenceLine
              yAxisId="money"
              y={totalPlan}
              stroke="#0284c7"
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{ value: 'plan', position: 'right', fontSize: 9, fill: '#0284c7' }}
            />
          )}
          {metric === 'volume' && (
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="orders"
              stroke="#7c3aed"
              strokeWidth={1.8}
              dot={false}
              name="Orders"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
