/**
 * Report document model + Markdown renderer.
 * The same builder powers both the on-screen "report mode" and the .md export,
 * so what a manager sees and what gets emailed are always identical.
 */
import { fmtDay, fmtInt, fmtMoney, fmtPct } from '../lib/format'
import type { OpsBundle } from '../data/selectors'
import { getDataset } from '../data/dataset'
import { formatKpiDelta, formatKpiValue } from '../components/ui/StatCard'
import { safeDiv } from '../lib/util'

export type TemplateId = 'exec' | 'fulfillment' | 'growth' | 'support'

export interface ReportTemplate {
  id: TemplateId
  name: string
  audience: string
  blurb: string
  sections: SectionId[]
}

export type SectionId = 'kpis' | 'trend' | 'regions' | 'channels' | 'inventory' | 'support' | 'risks' | 'customers'

export interface ReportOptions {
  template: TemplateId
  hideSections: Set<SectionId>
  note: string
}

export const TEMPLATES: ReportTemplate[] = [
  {
    id: 'exec',
    name: 'Executive summary',
    audience: 'Leadership · Mondays',
    blurb: 'One screen: where the business landed, what moved, what needs a decision.',
    sections: ['kpis', 'trend', 'regions', 'channels', 'risks', 'support'],
  },
  {
    id: 'fulfillment',
    name: 'Fulfillment deep-dive',
    audience: 'Ops leadership',
    blurb: 'Delivery performance, funnel loss, stockouts and the reasons behind late shipments.',
    sections: ['kpis', 'trend', 'regions', 'inventory', 'risks'],
  },
  {
    id: 'growth',
    name: 'Growth review',
    audience: 'Sales & marketing',
    blurb: 'Revenue, channel mix, plan attainment and customer momentum.',
    sections: ['kpis', 'trend', 'channels', 'customers', 'risks'],
  },
  {
    id: 'support',
    name: 'Support health',
    audience: 'CS leadership',
    blurb: 'Ticket load vs capacity, SLA attainment and the friction driving volume.',
    sections: ['kpis', 'support', 'risks'],
  },
]

export interface Section {
  id: SectionId
  heading: string
  kind: 'stats' | 'table' | 'bullets' | 'text'
  stats?: { label: string; value: string; delta?: string }[]
  table?: { head: string[]; rows: (string | number)[][] }
  bullets?: { text: string; tone?: 'ok' | 'warn' | 'bad' }[]
  text?: string
}

export function buildSections(ops: OpsBundle, opts: ReportOptions): Section[] {
  const tpl = TEMPLATES.find((t) => t.id === opts.template) ?? TEMPLATES[0]
  const wanted = tpl.sections.filter((s) => !opts.hideSections.has(s))
  const out: Section[] = []
  for (const id of wanted) {
    const sec = buildSection(id, ops)
    if (sec) out.push(sec)
  }
  return out
}

function buildSection(id: SectionId, ops: OpsBundle): Section | null {
  const t = ops.cur
  switch (id) {
    case 'kpis': {
      const ids = ['revenue', 'targetAttain', 'grossMargin', 'orders', 'onTime', 'fpo', 'sla', 'backlog']
      const stats = ids
        .map((k) => ops.kpis[k])
        .filter(Boolean)
        .map((k) => ({
          label: k.def.short,
          value: formatKpiValue(k.value, k.def.format),
          delta: k.delta === null ? undefined : formatKpiDelta(k),
        }))
      return { id, heading: 'Headline metrics', kind: 'stats', stats }
    }
    case 'trend': {
      const pts = ops.trend
      const half = Math.max(1, Math.ceil(pts.length / 2))
      const first = pts.slice(0, half).reduce((a, p) => a + p.revenue, 0)
      const second = pts.slice(half).reduce((a, p) => a + p.revenue, 0)
      const drift = first > 0 ? ((second - first) / first) * 100 : 0
      const best = [...pts].sort((a, b) => b.revenue - a.revenue)[0]
      const worst = [...pts].sort((a, b) => a.revenue - b.revenue)[0]
      return {
        id,
        heading: 'Trend',
        kind: 'bullets',
        bullets: [
          { text: `Revenue run-rate ${drift >= 0 ? 'accelerating' : 'cooling'} (${drift >= 0 ? '+' : ''}${drift.toFixed(1)}% second half vs first half of the window).`, tone: drift >= 0 ? 'ok' : 'warn' },
          { text: `Strongest bucket: ${best?.label ?? '—'} at ${fmtMoney(best?.revenue ?? 0)}; softest: ${worst?.label ?? '—'} at ${fmtMoney(worst?.revenue ?? 0)}.` },
          { text: `Tickets tracked volume: ${fmtInt(t.ticketsOpened)} opened / ${fmtInt(t.ticketsResolved)} resolved.`, tone: t.ticketsOpened > t.ticketsResolved * 1.2 ? 'warn' : 'ok' },
        ],
      }
    }
    case 'regions': {
      const rows = ops.regionSlices.map((s) => {
        const onTime = (1 - safeDiv(s.totals.lateDeliveries, s.totals.orders)) * 100
        const delta = s.prevTotals.revenue ? ((s.totals.revenue - s.prevTotals.revenue) / s.prevTotals.revenue) * 100 : null
        const margin = safeDiv(s.totals.revenue - s.totals.cogs, s.totals.revenue) * 100
        return [s.key, fmtMoney(s.totals.revenue), delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`, fmtInt(s.totals.orders), fmtPct(onTime), fmtPct(margin, 0)]
      })
      return { id, heading: 'Regional performance', kind: 'table', table: { head: ['Region', 'Revenue', 'Δ vs prior', 'Orders', 'On-time', 'Gross margin'], rows } }
    }
    case 'channels': {
      const total = Math.max(1, t.revenue)
      const rows = ops.channelSlices.map((s) => {
        const delta = s.prevTotals.revenue ? ((s.totals.revenue - s.prevTotals.revenue) / s.prevTotals.revenue) * 100 : null
        const aov = safeDiv(s.totals.revenue, s.totals.orders)
        return [s.key, fmtMoney(s.totals.revenue), fmtPct((s.totals.revenue / total) * 100, 0), fmtInt(s.totals.orders), fmtMoney(aov, false), delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`]
      })
      return { id, heading: 'Channel mix', kind: 'table', table: { head: ['Channel', 'Revenue', 'Share', 'Orders', 'AOV', 'Δ vs prior'], rows } }
    }
    case 'inventory': {
      const st = ops.stock
      return {
        id,
        heading: 'Inventory & replenishment',
        kind: 'stats',
        stats: [
          { label: 'Inventory value', value: fmtMoney(st.inventoryValue) },
          { label: 'Out of stock', value: `${st.outOfStock.length} SKUs` },
          { label: 'Below lead time', value: `${st.critical.length} SKUs` },
          { label: 'Avg cover', value: `${Math.round(st.avgCoverDays)}d` },
        ],
      }
    }
    case 'support': {
      return {
        id,
        heading: 'Support & SLA',
        kind: 'stats',
        stats: [
          { label: 'Backlog', value: fmtInt(ops.openBacklog) },
          { label: 'Past SLA', value: fmtInt(ops.overdueOpen) },
          { label: 'SLA attainment', value: fmtPct(ops.slaAttainPct, 0) },
          { label: 'Avg first response', value: `${Math.round(safeDiv(t.firstResponseMinSum, Math.max(1, t.ticketsOpened)))}m` },
        ],
      }
    }
    case 'risks': {
      const bullets = ops.insights.map((i) => ({
        text: `${i.title} — ${i.body}`,
        tone: (i.severity === 'critical' ? 'bad' : i.severity === 'warning' ? 'warn' : 'ok') as 'ok' | 'warn' | 'bad',
      }))
      return { id, heading: 'What needs attention', kind: 'bullets', bullets }
    }
    case 'customers': {
      const drivers = ops.scopedOrders.length
      return {
        id,
        heading: 'Customer momentum',
        kind: 'bullets',
        bullets: [
          { text: `${fmtInt(t.newCustomers)} new accounts opened (${drivers > 0 ? `across ${new Set(ops.scopedOrders.map((o) => o.customerId)).size} ordering accounts` : 'this window'}).`, tone: 'ok' },
          { text: `Average order value ${fmtMoney(safeDiv(t.revenue, t.orders), false)} on ${fmtInt(t.orders)} orders.` },
          { text: `Return rate ${fmtPct(safeDiv(t.returns, t.orders) * 100)} — monitor for quality-driven churn.`, tone: safeDiv(t.returns, t.orders) * 100 > 3 ? 'warn' : 'ok' },
        ],
      }
    }
  }
}

/* --------------------------- markdown export --------------------------- */

export function reportToMarkdown(ops: OpsBundle, opts: ReportOptions, title: string): string {
  const tpl = TEMPLATES.find((t) => t.id === opts.template) ?? TEMPLATES[0]
  const L: string[] = []
  L.push(`# OpsBoard — ${title}`)
  L.push('')
  L.push(`**Template:** ${tpl.name} · **Window:** ${fmtDay(ops.range.start, 'medium')} → ${fmtDay(ops.range.end, 'medium')} (${ops.days} days) · **Comparing to:** ${fmtDay(ops.prevRange.start)} → ${fmtDay(ops.prevRange.end)}`)
  if (opts.note.trim()) {
    L.push('')
    L.push(`> ${opts.note.trim()}`)
  }
  for (const sec of buildSections(ops, opts)) {
    L.push('')
    L.push(`## ${sec.heading}`)
    L.push('')
    if (sec.kind === 'stats' && sec.stats) {
      for (const s of sec.stats) L.push(`- **${s.label}:** ${s.value}${s.delta ? ` (${s.delta})` : ''}`)
    } else if (sec.kind === 'bullets' && sec.bullets) {
      for (const b of sec.bullets) L.push(`- ${b.text}`)
    } else if (sec.kind === 'text' && sec.text) {
      L.push(sec.text)
    } else if (sec.table) {
      L.push(`| ${sec.table.head.join(' | ')} |`)
      L.push(`| ${sec.table.head.map(() => '---').join(' | ')} |`)
      for (const row of sec.table.rows) L.push(`| ${row.join(' | ')} |`)
    }
  }
  L.push('')
  L.push(`---\n*Generated by OpsBoard on ${fmtDay(ops.today, 'medium')} · deterministic synthetic dataset (seed ${getDataset().seed})*`)
  return L.join('\n')
}

/** Plain-text version for clipboard paste into email/Slack. */
export function reportToPlaintext(ops: OpsBundle, opts: ReportOptions, title: string): string {
  return reportToMarkdown(ops, opts, title).replace(/^#+ /gm, '').replace(/\*\*/g, '').replace(/^> /gm, '')
}
