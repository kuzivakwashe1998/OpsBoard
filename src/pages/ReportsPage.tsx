import { useMemo, useState } from 'react'
import { Check, Copy, Download, Mail, Printer } from 'lucide-react'
import { useOps } from '../data/selectors'
import { Button, Card, TextInput, Toggle } from '../components/ui/primitives'
import { TrendChart } from '../components/charts/TrendChart'
import { buildSections, reportToMarkdown, reportToPlaintext, TEMPLATES, type ReportOptions, type SectionId, type TemplateId } from '../metrics/report'
import { fmtDay, fmtInt, fmtMoney, fmtPct } from '../lib/format'
import { copyToClipboard, downloadText } from '../lib/csv'
import { useStore } from '../state/store'
import { cn } from '../lib/cn'
import { safeDiv } from '../lib/util'

const SECTION_LABELS: Record<SectionId, string> = {
  kpis: 'Headline metrics',
  trend: 'Trend commentary',
  regions: 'Regional performance',
  channels: 'Channel mix',
  inventory: 'Inventory & replenishment',
  support: 'Support & SLA',
  risks: 'What needs attention',
  customers: 'Customer momentum',
}

export function ReportsPage() {
  const ops = useOps()
  const pushToast = useStore((s) => s.pushToast)
  const [template, setTemplate] = useState<TemplateId>('exec')
  const [hidden, setHidden] = useState<Set<SectionId>>(new Set())
  const [note, setNote] = useState('')
  const [title, setTitle] = useState(`Ops review — ${fmtDay(ops.range.end, 'medium')}`)
  const [copied, setCopied] = useState(false)

  const opts: ReportOptions = useMemo(() => ({ template, hideSections: hidden, note }), [template, hidden, note])
  const sections = useMemo(() => buildSections(ops, opts), [ops, opts])
  const tpl = TEMPLATES.find((t) => t.id === template)!

  const toggleSection = (id: SectionId) => {
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const markdown = useMemo(() => reportToMarkdown(ops, opts, title), [ops, opts, title])

  const exportCsv = () => {
    const rows: (string | number)[][] = [['section', 'label', 'value', 'delta']]
    for (const s of sections) {
      if (s.kind === 'stats' && s.stats) for (const st of s.stats) rows.push([s.heading, st.label, st.value, st.delta ?? ''])
      if (s.kind === 'bullets' && s.bullets) for (const b of s.bullets) rows.push([s.heading, '', b.text, ''])
      if (s.table) for (const r of s.table.rows) rows.push([s.heading, String(r[0]), String(r[1] ?? ''), String(r[2] ?? '')])
    }
    downloadText(`opsboard-report-${template}-${ops.today}.csv`, rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\r\n'))
    pushToast({ kind: 'success', title: 'Report exported', body: 'CSV written — ready for the board deck.' })
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Builder */}
      <div className="no-print col-span-12 space-y-4 xl:col-span-4 2xl:col-span-3">
        <Card title="1 · Pick a template" subtitle="One-page briefs, not slide theater">
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTemplate(t.id); setHidden(new Set()) }}
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5 text-left transition-all',
                  template === t.id
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500/30 dark:bg-emerald-500/[0.07]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{t.name}</span>
                  {template === t.id && <Check className="h-4 w-4 text-emerald-600" />}
                </span>
                <span className="muted mt-0.5 block text-[10.5px] font-medium uppercase tracking-wide">{t.audience}</span>
                <span className="muted mt-1 block text-[11px] leading-snug">{t.blurb}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="2 · Shape it" subtitle="Sections included in this report">
          <ul className="space-y-1.5">
            {tpl.sections.map((sid) => (
              <li key={sid} className="flex items-center justify-between rounded-lg px-1 py-0.5">
                <span className={cn('text-xs font-medium', hidden.has(sid) && 'text-slate-400 line-through dark:text-slate-500')}>{SECTION_LABELS[sid]}</span>
                <Toggle checked={!hidden.has(sid)} onChange={() => toggleSection(sid)} label="" />
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2">
            <TextInput aria-label="Report title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report title" />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a manager's note (shows as a callout at the top of the report)…"
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs shadow-sm placeholder:text-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </Card>

        <Card title="3 · Send it" subtitle="Export formats use the same section choices">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => window.print()} className="!py-2">
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
            <Button className="!py-2" onClick={() => downloadText(`opsboard-${template}-${ops.today}.md`, markdown, 'text/markdown')}>
              <Download className="h-4 w-4" /> Markdown
            </Button>
            <Button
              className="!py-2"
              onClick={async () => {
                const ok = await copyToClipboard(reportToPlaintext(ops, opts, title))
                setCopied(ok)
                setTimeout(() => setCopied(false), 1500)
                pushToast({ kind: ok ? 'success' : 'error', title: ok ? 'Report copied' : 'Clipboard blocked', body: ok ? 'Paste straight into email or Slack.' : 'Use the Markdown download instead.' })
              }}
            >
              <Copy className="h-4 w-4" /> {copied ? 'Copied!' : 'Copy text'}
            </Button>
            <Button className="!py-2" onClick={() => pushToast({ kind: 'success', title: 'Queued for delivery', body: `“${title}” scheduled for the ${tpl.audience.toLowerCase()} digest — simulated.` })}>
              <Mail className="h-4 w-4" /> Email team
            </Button>
            <Button className="col-span-2 !py-2" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export sections as CSV
            </Button>
          </div>
        </Card>
      </div>

      {/* The document */}
      <div className="col-span-12 xl:col-span-8 2xl:col-span-9">
        <article className="print-doc card mx-auto max-w-4xl px-6 py-8 sm:px-10">
          <header className="border-b-2 border-slate-900/80 pb-4 dark:border-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.22em] text-emerald-700 uppercase dark:text-emerald-400">OpsBoard · {tpl.name}</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
                <p className="muted mt-1 text-[11px]">
                  Window {fmtDay(ops.range.start, 'medium')} – {fmtDay(ops.range.end, 'medium')} ({ops.days} days) · comparison vs {fmtDay(ops.prevRange.start)} – {fmtDay(ops.prevRange.end)} · generated {fmtDay(ops.today, 'medium')}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="tnum text-lg font-bold text-emerald-700 dark:text-emerald-400">{fmtMoney(ops.cur.revenue)}</p>
                <p className="muted text-[10px] font-medium uppercase">revenue in window</p>
              </div>
            </div>
            {note.trim() && (
              <blockquote className="mt-3 rounded-r-lg border-l-4 border-emerald-500 bg-emerald-50/60 px-3 py-2 text-[12px] leading-relaxed italic dark:bg-emerald-500/[0.06]">
                “{note.trim()}”
              </blockquote>
            )}
          </header>

          {sections.map((s, i) => (
            <section key={s.id + i} className={cn('print-avoid-break mt-6', i > 2 && 'break-inside-avoid')}>
              <h3 className="mb-2 text-[11px] font-bold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">{s.heading}</h3>

              {s.kind === 'stats' && s.stats && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {s.stats.map((st) => (
                    <div key={st.label} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <p className="muted text-[9.5px] font-semibold tracking-wide uppercase">{st.label}</p>
                      <p className="tnum mt-0.5 text-[15px] font-bold tracking-tight">{st.value}</p>
                      {st.delta && <p className="muted tnum text-[10px] font-medium">{st.delta}</p>}
                    </div>
                  ))}
                </div>
              )}

              {s.kind === 'bullets' && s.bullets && (
                <ul className="space-y-1.5">
                  {s.bullets.map((b, bi) => (
                    <li key={bi} className="flex items-start gap-2 text-[13px] leading-relaxed">
                      <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', b.tone === 'bad' ? 'bg-rose-500' : b.tone === 'warn' ? 'bg-amber-500' : b.tone === 'ok' ? 'bg-emerald-500' : 'bg-slate-400')} />
                      <span>{b.text}</span>
                    </li>
                  ))}
                  {s.bullets.length === 0 && <li className="muted text-xs">Nothing to flag.</li>}
                </ul>
              )}

              {s.table && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60">
                        {s.table.head.map((h) => (
                          <th key={h} className="px-3 py-1.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((r, ri) => (
                        <tr key={ri} className="border-t border-slate-100 dark:border-slate-800">
                          {r.map((c, ci) => (
                            <td key={ci} className={cn('px-3 py-1.5', ci > 0 && 'tnum')}>{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          {/* Visual: revenue trend + regional snapshot */}
          {(!hidden.has('trend') || !hidden.has('regions')) && (
            <section className="print-avoid-break mt-6">
              <h3 className="mb-2 text-[11px] font-bold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">Visual appendix</h3>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <TrendChart data={ops.trend} showPrev height={200} metric="revenue" planLine={ops.cur.targetRevenue / Math.max(1, ops.trend.length)} />
              </div>
              <p className="muted mt-1.5 text-[10.5px]">
                Solid line: revenue by {ops.bucket === 'day' ? 'day' : ops.bucket === 'week' ? 'week' : 'month'} · dashed: prior period · thin blue: blended cost · flat blue: plan/bucket.
              </p>
            </section>
          )}

          <footer className="muted mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-[10px] dark:border-slate-700">
            <span>OpsBoard · synthetic deterministic dataset · on-time {fmtPct((1 - safeDiv(ops.cur.lateDeliveries, ops.cur.orders)) * 100)}, {fmtInt(ops.cur.orders)} orders, SLA {fmtPct(ops.slaAttainPct, 0)}</span>
            <span className="no-print">Print → “Save as PDF” for the board-ready version</span>
          </footer>
        </article>
      </div>
    </div>
  )
}
