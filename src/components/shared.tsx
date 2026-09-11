import type { OrderStatus, Priority, TicketStatus } from '../data/model'
import type { SkuComputed } from '../data/selectors'
import { Badge, type Tone } from './ui/primitives'

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: 'neutral',
  picking: 'sky',
  in_transit: 'sky',
  delivered: 'emerald',
  delayed: 'amber',
  returned: 'violet',
  cancelled: 'rose',
}

export const TICKET_STATUS_TONE: Record<TicketStatus, Tone> = {
  open: 'amber',
  in_progress: 'sky',
  waiting_customer: 'neutral',
  resolved: 'emerald',
}

export const PRIORITY_TONE: Record<Priority, Tone> = {
  critical: 'rose',
  high: 'amber',
  medium: 'sky',
  low: 'neutral',
}

export const STOCK_STATUS_TONE: Record<SkuComputed['status'], Tone> = {
  out_of_stock: 'rose',
  critical: 'rose',
  low: 'amber',
  healthy: 'emerald',
}

const LABEL: Record<string, string> = {
  pending: 'Pending',
  picking: 'Picking',
  in_transit: 'In transit',
  delivered: 'Delivered',
  delayed: 'Delayed',
  returned: 'Returned',
  cancelled: 'Cancelled',
  open: 'Open',
  in_progress: 'In progress',
  waiting_customer: 'Waiting on customer',
  resolved: 'Resolved',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  out_of_stock: 'Out of stock',
  healthy: 'Healthy',
}

export function StatusBadge({ status, tone }: { status: string; tone: Tone }) {
  return (
    <Badge tone={tone} dot>
      {LABEL[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  )
}

export function orderSlaState(o: { status: OrderStatus; promiseDate: string; deliveredAt?: string; today: string }) {
  if (o.status === 'delivered' || o.status === 'returned') {
    if (!o.deliveredAt) return { label: 'Delivered', tone: 'emerald' as Tone }
    const lateDays = Math.round((Date.parse(o.deliveredAt.slice(0, 10)) - Date.parse(o.promiseDate)) / 86_400_000)
    return lateDays > 0 ? { label: `Delivered ${lateDays}d late`, tone: 'amber' as Tone } : { label: 'Delivered on time', tone: 'emerald' as Tone }
  }
  if (o.status === 'cancelled') return { label: 'Cancelled', tone: 'rose' as Tone }
  if (o.status === 'delayed') return { label: 'Overdue — late', tone: 'rose' as Tone }
  const dueIn = Math.round((Date.parse(o.promiseDate) - Date.parse(o.today)) / 86_400_000)
  if (dueIn < 0) return { label: `At risk (${Math.abs(dueIn)}d past promise)`, tone: 'amber' as Tone }
  if (dueIn === 0) return { label: 'Due today', tone: 'amber' as Tone }
  return { label: `In window (${dueIn}d left)`, tone: 'sky' as Tone }
}

export function ticketSlaState(t: { status: TicketStatus; createdAt: string; slaHours: number; breached: boolean }, nowMs: number) {
  const due = Date.parse(t.createdAt) + t.slaHours * 3_600_000
  const minsLeft = Math.round((due - nowMs) / 60_000)
  if (t.status === 'resolved') {
    return { label: t.breached ? 'Resolved late' : 'Resolved in SLA', tone: t.breached ? ('amber' as Tone) : ('emerald' as Tone) }
  }
  if (minsLeft < 0) return { label: `Breached ${Math.abs(minsLeft) > 60 ? `${Math.round(Math.abs(minsLeft) / 60)}h` : `${minsLeft}m`} over`, tone: 'rose' as Tone }
  if (minsLeft < 120) return { label: `Due in ${minsLeft}m`, tone: 'amber' as Tone }
  return { label: `On track`, tone: 'sky' as Tone }
}
