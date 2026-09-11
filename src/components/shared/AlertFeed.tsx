import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info, Radio, PackageX, Truck, Ticket, ShoppingCart } from 'lucide-react'
import dayjs from 'dayjs'
import { getDataset } from '../../data/dataset'
import { useStore } from '../../state/store'
import { cn } from '../../lib/cn'
import { fmtMoney } from '../../lib/format'
import type { AlertRecord } from '../../data/model'
import type { LiveEvent } from '../../state/store'

const SEV_STYLE: Record<AlertRecord['severity'], { color: string; icon: typeof Info }> = {
  critical: { color: 'text-rose-500', icon: AlertTriangle },
  warning: { color: 'text-amber-500', icon: AlertTriangle },
  success: { color: 'text-emerald-500', icon: CheckCircle2 },
  info: { color: 'text-slate-400', icon: Info },
}

const LIVE_ICON: Record<LiveEvent['kind'], typeof Info> = {
  order: ShoppingCart,
  ticket_resolved: Ticket,
  ticket_opened: Ticket,
  shipment: Truck,
  stock: PackageX,
}

interface FeedItem {
  id: string
  live: boolean
  at: string
  title: string
  body: string
  severity: AlertRecord['severity']
  link?: string
}

export function AlertFeed({ className }: { className?: string }) {
  const ds = getDataset()
  const live = useStore((s) => s.live)
  const liveEvents = useStore((s) => s.liveEvents)

  const datasetItems: FeedItem[] = ds.alerts.map((a) => ({ id: a.id, live: false, at: a.at, title: a.title, body: a.body, severity: a.severity, link: a.link }))
  const items: FeedItem[] = live
    ? [
        ...liveEvents.map((e) => ({
          id: `live-${e.id}`,
          live: true,
          at: e.at,
          title: e.text,
          body: e.revenue ? `${fmtMoney(e.revenue)} · ${e.channel} · ${e.region}` : `${e.region}`,
          severity: (e.kind === 'stock' ? 'warning' : 'info') as AlertRecord['severity'],
        })),
        ...datasetItems,
      ]
    : datasetItems

  return (
    <ul className={cn('-mx-1 max-h-[340px] space-y-2.5 overflow-y-auto px-1 pb-1', className)} aria-label="Activity feed">
      {items.slice(0, 14).map((it) => {
        const sev = SEV_STYLE[it.severity] ?? SEV_STYLE.info
        const Icon = it.live ? LIVE_ICON[(liveEvents.find((e) => `live-${e.id}` === it.id)?.kind ?? 'info') as keyof typeof LIVE_ICON] ?? Info : sev.icon
        const inner = (
          <li className={cn('group flex gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors', it.link && 'hover:bg-slate-50 dark:hover:bg-slate-800/60')}>
            <span className="relative mt-0.5">
              <Icon className={cn('h-4 w-4 shrink-0', it.live ? 'text-emerald-600 dark:text-emerald-400' : sev.color)} />
              {it.live && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] leading-snug font-medium">{it.title}</span>
              <span className="muted block truncate text-[10.5px]">
                {it.body} · {dayjs(it.at).fromNow()}
              </span>
            </span>
          </li>
        )
        return it.link ? (
          <Link key={it.id} to={it.link} className="block">
            {inner}
          </Link>
        ) : (
          <div key={it.id}>{inner}</div>
        )
      })}
      {!live && (
        <li className="muted flex items-center justify-center gap-1.5 pt-1 text-[10.5px]">
          <Radio className="h-3 w-3" /> Enable live mode in the sidebar for a streaming feed
        </li>
      )}
    </ul>
  )
}
