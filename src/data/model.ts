/**
 * Domain model for the OpsBoard simulation.
 * A mid-market industrial products distributor: five warehouses, four
 * regions, four sales channels, ~2 years of daily operations history.
 */

export const REGIONS = ['North America', 'EMEA', 'APAC', 'LATAM'] as const
export type Region = (typeof REGIONS)[number]

export const CHANNELS = ['Online', 'Retail', 'Wholesale', 'Partner'] as const
export type Channel = (typeof CHANNELS)[number]

export const CATEGORIES = [
  'Power Tools',
  'Safety & PPE',
  'Fasteners',
  'Fluids & Lubricants',
  'Electrical',
  'Packaging',
  'MRO Consumables',
  'Bearings & Drives',
] as const
export type Category = (typeof CATEGORIES)[number]

export const SEGMENTS = ['Enterprise', 'Mid-Market', 'SMB'] as const
export type Segment = (typeof SEGMENTS)[number]

export const ORDER_STATUSES = [
  'pending',
  'picking',
  'in_transit',
  'delivered',
  'delayed',
  'returned',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const SLA_HOURS: Record<Priority, number> = { critical: 4, high: 8, medium: 24, low: 48 }

export const CUSTOMER_STATUSES = ['active', 'at_risk', 'dormant', 'churned'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

/** One day of operations for one region × channel cell. */
export interface DailyRow {
  day: string // yyyy-mm-dd
  region: Region
  channel: Channel
  orders: number
  unitsShipped: number
  revenue: number
  cogs: number
  fulfillmentCost: number
  lateDeliveries: number
  returns: number
  newCustomers: number
  ticketsOpened: number
  ticketsResolved: number
  firstResponseMinSum: number
  inventoryValue: number // snapshot $ of stocked inventory attributed to this cell
  stockoutEvents: number
  targetRevenue: number
}

export interface OrderLine {
  sku: string
  name: string
  qty: number
  unitPrice: number
}

export interface OrderRecord {
  id: string
  createdAt: string // ISO datetime
  day: string
  region: Region
  channel: Channel
  warehouse: string
  customerId: string
  customer: string
  segment: Segment
  rep: string
  status: OrderStatus
  value: number
  itemCount: number
  lines: OrderLine[]
  promiseDate: string
  shippedAt?: string
  deliveredAt?: string
  carrier: string
  delayReason?: string
  priorityRush: boolean
}

export interface TicketRecord {
  id: string
  subject: string
  customerId: string
  customer: string
  region: Region
  priority: Priority
  status: TicketStatus
  tag: string
  agent: string
  createdAt: string
  firstResponseAt?: string
  resolvedAt?: string
  slaHours: number
  breached: boolean
}

export interface SkuWarehouseStock {
  warehouse: string
  qty: number
}

export interface SkuRecord {
  sku: string
  name: string
  category: Category
  price: number
  cost: number
  supplier: string
  leadTimeDays: number
  dailyDemand: number // avg units/day across network
  reorderPoint: number
  stock: SkuWarehouseStock[]
}

export interface CustomerRecord {
  id: string
  name: string
  segment: Segment
  region: Region
  since: string
  orders: number
  lifetimeValue: number
  aov: number
  lastOrderDays: number
  healthScore: number
  churnRisk: 'low' | 'medium' | 'high'
  status: CustomerStatus
}

export interface RepRecord {
  name: string
  region: Region
  quota: number
  closedRevenue: number
  attainmentPct: number
  openDeals: number
}

export interface Warehouse {
  code: string
  city: string
  region: Region
}

export interface AlertRecord {
  id: string
  at: string // ISO datetime
  severity: 'info' | 'success' | 'warning' | 'critical'
  title: string
  body: string
  link?: string
}

export interface Dataset {
  seed: number
  today: string
  generatedAt: string
  startDay: string
  daily: DailyRow[]
  orders: OrderRecord[]
  tickets: TicketRecord[]
  skus: SkuRecord[]
  customers: CustomerRecord[]
  reps: RepRecord[]
  warehouses: Warehouse[]
  suppliers: string[]
  alerts: AlertRecord[]
  /** Tickets opened per weekday (Mon-first) × hour, for the volume heatmap. */
  hourlyByDow: number[][]
}
