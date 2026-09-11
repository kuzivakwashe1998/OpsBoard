import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, FileText, Package, Search, ShoppingCart, Ticket, LayoutGrid } from 'lucide-react'
import { useStore } from '../../state/store'
import { getDataset } from '../../data/dataset'
import { fuzzyScore } from '../../lib/cn'
import { cn } from '../../lib/cn'
import { fmtMoney } from '../../lib/format'
import { computeStock } from '../../data/selectors'

interface PaletteItem {
  id: string
  group: 'Jump to' | 'Key metrics' | 'Orders' | 'SKUs' | 'Tickets' | 'Customers'
  icon: typeof Search
  title: string
  sub?: string
  to?: string
}

const PAGE_ITEMS: PaletteItem[] = [
  { id: 'p-overview', group: 'Jump to', icon: LayoutGrid, title: 'Overview dashboard', to: '/' },
  { id: 'p-orders', group: 'Jump to', icon: ShoppingCart, title: 'Orders & fulfillment', to: '/orders' },
  { id: 'p-inventory', group: 'Jump to', icon: Package, title: 'Inventory & replenishment', to: '/inventory' },
  { id: 'p-support', group: 'Jump to', icon: Ticket, title: 'Support & SLA', to: '/support' },
  { id: 'p-customers', group: 'Jump to', icon: FileText, title: 'Customers & reps', to: '/customers' },
  { id: 'p-reports', group: 'Jump to', icon: FileText, title: 'Reports', to: '/reports' },
]

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const setOpen = useStore((s) => s.setPaletteOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useStore.getState().paletteOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const ds = getDataset()
    const base: PaletteItem[] = [...PAGE_ITEMS]
    for (const o of ds.orders.slice(0, 400)) {
      base.push({ id: o.id, group: 'Orders', icon: ShoppingCart, title: `${o.id} · ${o.customer}`, sub: `${fmtMoney(o.value)} — ${o.status.replace('_', ' ')} — ${o.region}`, to: `/orders?focus=${o.id}` })
    }
    for (const s of computeStock(ds.skus).items) {
      base.push({ id: s.sku, group: 'SKUs', icon: Package, title: `${s.sku} · ${s.name}`, sub: `${s.category} — ${s.totalStock} on hand — ${s.status.replaceAll('_', ' ')}`, to: `/inventory?focus=${s.sku}` })
    }
    for (const t of ds.tickets.slice(0, 250)) {
      base.push({ id: t.id, group: 'Tickets', icon: Ticket, title: `${t.id} · ${t.subject}`, sub: `${t.priority} — ${t.status.replace('_', ' ')} — ${t.customer}`, to: `/support?focus=${t.id}` })
    }
    for (const c of ds.customers.slice(0, 240)) {
      base.push({ id: c.id, group: 'Customers', icon: FileText, title: c.name, sub: `${c.segment} — ${c.region} — ${c.status.replaceAll('_', ' ')}`, to: `/customers?focus=${c.id}` })
    }
    return base
  }, [])

  const results = useMemo(() => {
    const scored = items
      .map((it) => ({ it, score: Math.max(fuzzyScore(`${it.title} ${it.sub ?? ''}`, query)) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, 24).map((x) => x.it)
  }, [items, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const run = (it?: PaletteItem) => {
    const item = it ?? results[active]
    if (!item) return
    setOpen(false)
    if (item.to) navigate(item.to)
  }

  let lastGroup: string | null = null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh] backdrop-blur-[2px]" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="card w-full max-w-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-slate-200/80 px-4 dark:border-slate-800">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run()
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder="Jump to a page, order, SKU, ticket or account…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            aria-label="Search"
          />
          <kbd className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-600">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-1.5">
          {results.length === 0 && <p className="muted px-4 py-6 text-center text-xs">No matches for “{query}”.</p>}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <div key={it.id}>
                {header && <p className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{header}</p>}
                <button
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(it)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left text-[13px]',
                    i === active ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                  )}
                >
                  <it.icon className={cn('h-4 w-4 shrink-0', i === active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{it.title}</span>
                    {it.sub && <span className="muted block truncate text-[11px]">{it.sub}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-600/70 dark:text-emerald-400/70" />}
                </button>
              </div>
            )
          })}
        </div>
        <div className="muted flex items-center justify-between border-t border-slate-200/80 px-4 py-2 text-[10.5px] dark:border-slate-800">
          <span>↑↓ navigate · ↵ open · ⌘K toggle</span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
