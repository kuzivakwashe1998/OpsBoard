/**
 * Deterministic operations-simulation engine.
 *
 * Produces ~2 years of daily aggregates (region × channel), plus detail
 * records (orders, tickets, SKUs, customers, reps, alerts). Given the same
 * seed and "today", output is byte-for-byte identical — charts never jump
 * around between reloads, and tests can assert on real generated data.
 */
import dayjs from 'dayjs'
import {
  clamp,
  mulberry32,
  randBetween,
  randGauss,
  randInt,
  randLognormal,
  randPick,
  shuffle,
  weightedPick,
  type Rng,
} from '../lib/rng'
import {
  CATEGORIES,
  CHANNELS,
  REGIONS,
  SLA_HOURS,
  type AlertRecord,
  type Category,
  type Channel,
  type CustomerRecord,
  type DailyRow,
  type Dataset,
  type OrderLine,
  type OrderRecord,
  type OrderStatus,
  type Priority,
  type Region,
  type RepRecord,
  type Segment,
  type SkuRecord,
  type TicketRecord,
  type Warehouse,
} from './model'

export const SEED = 20260911
const HISTORY_DAYS = 730
const ORDER_LOOKBACK = 91
const TICKET_LOOKBACK = 60

interface RegionCfg {
  base: number // baseline orders/day
  growth: number // annual growth
  aovMod: number
  marginMod: number
  lateMod: number
  retMod: number
  invShare: number
  promiseDays: number
}

const REGION_CFG: Record<Region, RegionCfg> = {
  'North America': { base: 66, growth: 0.22, aovMod: 1.18, marginMod: 0.02, lateMod: 0.9, retMod: 0.9, invShare: 0.4, promiseDays: 3 },
  EMEA: { base: 52, growth: 0.15, aovMod: 1.04, marginMod: 0.0, lateMod: 1.15, retMod: 1.05, invShare: 0.3, promiseDays: 4 },
  APAC: { base: 38, growth: 0.46, aovMod: 0.88, marginMod: -0.02, lateMod: 1.45, retMod: 1.25, invShare: 0.2, promiseDays: 6 },
  LATAM: { base: 17, growth: 0.3, aovMod: 0.72, marginMod: -0.05, lateMod: 1.7, retMod: 1.4, invShare: 0.1, promiseDays: 7 },
}

interface ChannelCfg {
  weight: number
  aov: number
  marginMod: number
  lateMod: number
  ret: number
  fpo: number // fulfillment cost/order baseline
  ticketFactor: number
  weekendMult: number
}

const CHANNEL_CFG: Record<Channel, ChannelCfg> = {
  Online: { weight: 0.46, aov: 420, marginMod: 0.02, lateMod: 1.0, ret: 0.045, fpo: 16.5, ticketFactor: 1.0, weekendMult: 1.4 },
  Retail: { weight: 0.17, aov: 190, marginMod: 0.06, lateMod: 0.7, ret: 0.03, fpo: 8, ticketFactor: 0.55, weekendMult: 1.9 },
  Wholesale: { weight: 0.21, aov: 2450, marginMod: -0.07, lateMod: 1.3, ret: 0.012, fpo: 33, ticketFactor: 1.35, weekendMult: 0.05 },
  Partner: { weight: 0.16, aov: 980, marginMod: -0.015, lateMod: 1.1, ret: 0.02, fpo: 23, ticketFactor: 0.8, weekendMult: 0.5 },
}

// Sun..Sat traffic curve for a B2B-heavy operation.
const WEEKDAY_FLOW = [0.24, 1.2, 1.3, 1.24, 1.1, 0.8, 0.22]

// Hour-of-day order volume (business-hours skew).
const DAY_PROFILE = [2, 1, 1, 1, 1, 1, 2, 5, 9, 13, 16, 17, 15, 16, 15, 13, 11, 8, 5, 3, 2, 1, 1, 1]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const WAREHOUSES: Warehouse[] = [
  { code: 'ORD', city: 'Chicago, US', region: 'North America' },
  { code: 'DFW', city: 'Dallas, US', region: 'North America' },
  { code: 'BER', city: 'Berlin, DE', region: 'EMEA' },
  { code: 'SIN', city: 'Singapore, SG', region: 'APAC' },
  { code: 'MEX', city: 'Monterrey, MX', region: 'LATAM' },
]

const SUPPLIERS = [
  'Atlas Supply Co',
  'Borealis Components',
  'CoreSource Ltd',
  'Delta Parts Works',
  'Everest Materials',
  'Fjord Industrial',
  'Granite & Sons',
  'Helm Manufacturing',
]

const COURIERS = ['Northline Freight', 'SwiftEx', 'Pancoast Carriers', 'Regional Direct', 'AeroGlobal', 'RoadRunner']

const DELAY_REASONS = [
  'Carrier delay',
  'Customs hold',
  'Severe weather',
  'Warehouse backlog',
  'Address validation',
  'Inventory short',
  'Peak volume',
]

const COMPANY_A = [
  'Northwind', 'Bluepeak', 'Harborline', 'Ironclad', 'Summit', 'Vertex', 'Lakeshore', 'Brightpath',
  'Copperfield', 'Granite', 'Westbridge', 'Everline', 'Northgate', 'Pinnacle', 'Riverstone', 'Solstice',
  'Tidewater', 'Kingsley', 'Meridian', 'Atlas', 'Beacon', 'Cascade', 'Halcyon', 'Lodestar',
  'Onyx', 'Redwood', 'Sterling', 'Vantage', 'Windward', 'Quarry', 'Foundry', 'Bramble',
]
const COMPANY_B = [
  'Industrial', 'Logistics', 'Manufacturing', 'Supply Co', 'Furniture Works', 'Foods', 'Materials',
  'Equipment Group', 'Systems', 'Fabricators', 'Toolworks', 'Marine', 'Energy', 'Automation', 'Plastics',
  'Steelworks',
]

const FIRST_NAMES = [
  'Jordan', 'Amara', 'Wei', 'Sofia', 'Liam', 'Priya', 'Noah', 'Elena', 'Marcus', 'Yuki', 'Aisha', 'Tomas',
  'Ingrid', 'Diego', 'Fatima', 'Owen', 'Nadia', 'Felix', 'Rosa', 'Ken',
]
const LAST_NAMES = [
  'Ellis', 'Okafor', 'Chen', 'Ramirez', 'Novak', 'Haddad', 'Kimura', 'Silva', 'Berger', 'Kowalski',
  'Diallo', 'Marchetti', 'Petrov', 'Nguyen', 'Larsen', 'Osei', 'Tanaka', 'Moreau', 'Vargas', 'Weiss',
]

const SKU_NAMES: Record<Category, string[]> = {
  'Power Tools': ['Cordless Impact Driver', 'Angle Grinder 125mm', 'Rotary Hammer SDS+', 'Reciprocating Saw', 'Bench Drill Press', 'Heat Gun Pro'],
  'Safety & PPE': ['Cut-5 Nitrile Gloves', 'Safety Goggles ANSI-Z87', 'Hard Hat Vented', 'Hi-Vis Class 2 Vest', 'Respirator Half-Face', 'Steel-Toe Boots'],
  Fasteners: ['M8 Hex Bolts (500pk)', 'Stainless Washers M6', 'Structural Rivets', 'Self-Tapping Screws', 'Anchor Bolt Kits', 'Nyloc Locknuts'],
  'Fluids & Lubricants': ['Synthetic Gear Oil 20L', 'Cutting Fluid Concentrate', 'Penetrating Spray', 'Hydraulic AW-46', 'Thread Locker', 'Grease Cartridges'],
  Electrical: ['Cable Tie Mounts', 'IP67 Junction Box', 'Contactor 3P 40A', 'Circuit Breaker MCB', 'Panel Wiring Duct', 'LED Work Light'],
  Packaging: ['Double-Wall Cartons', 'Stretch Film Rolls', 'Pallet Wrap Dispenser', 'Edge Protectors', 'Void Fill Paper', 'Strapping Buckles'],
  'MRO Consumables': ['Shop Towels (case)', 'Wire Brushes', 'Abrasive Discs 40g', 'Utility Blades', 'Sealant Tape', 'Cleaning Solvent'],
  'Bearings & Drives': ['Sealed Ball Bearing 6205', 'V-Belt A-Section', 'Timing Pulley 20T', 'Shaft Collar Kit', 'Linear Rail Guide', 'Gear Coupling'],
}

const TICKET_TAGS = ['shipping', 'returns', 'billing', 'account', 'technical', 'order'] as const
type TicketTag = (typeof TICKET_TAGS)[number]

const TICKET_SUBJECTS: Record<TicketTag, string[]> = {
  shipping: ['Where is my order?', 'Delivery missed promised date', 'Package arrived damaged', 'Tracking not updating', 'Split shipment query'],
  returns: ['Return label request', 'Refund not received', 'Wrong item delivered', 'Return pickup scheduling', 'Restocking fee question'],
  billing: ['Invoice mismatch', 'Payment failed on renewal PO', 'Duplicate charge on order', 'Tax on international order', 'Credit terms review'],
  account: ['Update ship-to address', 'Add portal users', 'Contract pricing question', 'Merge duplicate accounts', 'Annual rebate statement'],
  technical: ['Product spec question', 'Certification docs needed (MSDS)', 'Compatibility with legacy units', 'Firmware for smart tools', 'Warranty claim setup'],
  order: ['Order amendment request', 'Cancel line item', 'Rush order feasibility', 'Backorder ETA question', 'PO reference missing'],
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function namePool(rng: Rng, count: number): string[] {
  const out: string[] = []
  const used = new Set<string>()
  while (out.length < count && used.size < COMPANY_A.length * COMPANY_B.length) {
    const name = `${randPick(rng, COMPANY_A)} ${randPick(rng, COMPANY_B)}`
    if (!used.has(name)) {
      used.add(name)
      out.push(name)
    }
  }
  return out
}

function peopleNames(rng: Rng, count: number): string[] {
  const out: string[] = []
  const used = new Set<string>()
  let guard = 0
  while (out.length < count && guard++ < 500) {
    const n = `${randPick(rng, FIRST_NAMES)} ${randPick(rng, LAST_NAMES)}`
    if (!used.has(n)) {
      used.add(n)
      out.push(n)
    }
  }
  return out
}

const hhmm = (h: number, m: number): string =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`

/* ------------------------------------------------------------------ */
/* main generator                                                      */
/* ------------------------------------------------------------------ */

export function generateDataset(seed: number = SEED, today: string = dayjs().format('YYYY-MM-DD')): Dataset {
  const rng = mulberry32(seed)
  const t0 = dayjs(today)
  // Standardize "now" at 13:40 on the last day so the feed/timeline always has content.
  const now = t0.hour(13).minute(40).second(0)
  const start = t0.subtract(HISTORY_DAYS - 1, 'day')

  // ---- event calendars -------------------------------------------------
  // Service disruptions (carrier outages, weather) hurt the last few months.
  const disruptions = new Map<number, number>()
  for (let i = 0; i < 7; i++) {
    disruptions.set(randInt(rng, HISTORY_DAYS - 240, HISTORY_DAYS - 4), randBetween(rng, 1.8, 3.1))
  }
  // Marketing campaigns spike Online/Partner volume.
  const campaigns = new Map<number, number>()
  for (let i = 0; i < 12; i++) {
    campaigns.set(randInt(rng, Math.floor(HISTORY_DAYS * 0.3), HISTORY_DAYS - 2), randBetween(rng, 1.4, 2.0))
  }

  // ---- global inventory value random walk ------------------------------
  let inv = 8.6e6
  const invSeries: number[] = []
  for (let d = 0; d < HISTORY_DAYS; d++) {
    inv = Math.max(4e6, inv * 1.00042 + randGauss(rng, 0, 95e3) + 55e3 * Math.cos((d / 43) * 2 * Math.PI))
    invSeries.push(inv)
  }

  // ---- daily aggregates -------------------------------------------------
  const daily: DailyRow[] = []
  const dayRowsMap = new Map<string, DailyRow[]>()

  for (let d = 0; d < HISTORY_DAYS; d++) {
    const dayT = start.add(d, 'day')
    const dayIso = dayT.format('YYYY-MM-DD')
    const dow = dayT.day()
    const month = dayT.month() + 1
    const dom = dayT.date()
    const dim = dayT.daysInMonth()
    const yf = d / 365
    const seasonal = 1 + 0.11 * Math.cos(((month - 10.5) / 12) * 2 * Math.PI)
    const monthEnd = dom >= dim - 3 ? 1.09 : 1
    const quarterEnd = month % 3 === 0 && dom >= dim - 5 ? 1.12 : 1
    const disrupt = disruptions.get(d)
    const campaign = campaigns.get(d)
    const rows: DailyRow[] = []

    for (const region of REGIONS) {
      const rc = REGION_CFG[region]
      for (const channel of CHANNELS) {
        const cc = CHANNEL_CFG[channel]
        const flow = WEEKDAY_FLOW[dow] * (dow === 0 || dow === 6 ? cc.weekendMult : 1)
        let lateMult = 1
        let ordersMult = 1
        let ticketMult = 1
        if (disrupt) {
          lateMult = disrupt
          ordersMult = 0.92
          ticketMult = 1.6
        }
        if (campaign && (channel === 'Online' || channel === 'Partner')) {
          ordersMult *= campaign
          lateMult *= 1.25
        }
        const growth = 1 + rc.growth * yf
        const orders = Math.max(0, Math.round(rc.base * cc.weight * flow * seasonal * monthEnd * quarterEnd * growth * randLognormal(rng, 0.075) * ordersMult))
        const aov = cc.aov * rc.aovMod * (1 + 0.05 * yf) * randLognormal(rng, 0.13)
        const revenue = orders * aov
        const margin = clamp(
          0.345 + rc.marginMod + cc.marginMod + 0.02 * Math.sin(d / 58 + rc.lateMod) + randGauss(rng, 0, 0.011) - (campaign ? 0.03 : 0),
          0.12,
          0.55,
        )
        const cogs = revenue * (1 - margin)
        const fulfillmentCost =
          orders * cc.fpo * (1 + 0.3 * (rc.lateMod - 1)) * randLognormal(rng, 0.04) + (channel === 'Wholesale' ? orders * 5.2 : 0)
        const lateRate = clamp(0.052 * rc.lateMod * cc.lateMod * (1 + 0.5 * Math.sin(d / 37)) * lateMult + randGauss(rng, 0, 0.008), 0.004, 0.7)
        const lateDeliveries = Math.round(orders * lateRate)
        const returns = Math.round(orders * clamp(cc.ret * rc.retMod + randGauss(rng, 0, 0.004), 0.002, 0.12))
        const unitsShipped = Math.round(orders * (channel === 'Wholesale' ? 12 : channel === 'Retail' ? 3.4 : 2.1) * randLognormal(rng, 0.09))
        const newCustomers = Math.round(
          orders * (channel === 'Online' ? 0.14 : channel === 'Retail' ? 0.07 : 0.03) * randLognormal(rng, 0.3),
        )
        const ticketsOpened = Math.round(orders * 0.05 * cc.ticketFactor * (1 + lateRate * 6) * ticketMult * randLognormal(rng, 0.16))
        const ticketsResolved = Math.round(ticketsOpened * clamp(0.95 + 0.2 * Math.sin(d / 13) + randGauss(rng, 0, 0.05), 0.6, 1.35))
        const frAvg =
          22 + 30 * cc.ticketFactor + (dow === 0 || dow === 6 ? 38 : 0) + Math.abs(randGauss(rng, 0, 12)) + (disrupt ? 35 : 0)
        const stockoutEvents = Math.max(0, Math.round(randGauss(rng, 0.5 * rc.lateMod + (disrupt ? 2 : 0), 0.9)))
        // Plan curve: same seasonality, slower growth, no noise — attainment hovers around 100%.
        const targetRevenue =
          rc.base * cc.weight * flow * seasonal * monthEnd * quarterEnd * (1 + rc.growth * 0.8 * yf) * cc.aov * rc.aovMod * (1 + 0.05 * yf)

        const row: DailyRow = {
          day: dayIso,
          region,
          channel,
          orders,
          unitsShipped,
          revenue,
          cogs,
          fulfillmentCost,
          lateDeliveries,
          returns,
          newCustomers,
          ticketsOpened,
          ticketsResolved,
          firstResponseMinSum: ticketsOpened * frAvg,
          inventoryValue: invSeries[d] * rc.invShare * cc.weight,
          stockoutEvents,
          targetRevenue,
        }
        rows.push(row)
      }
    }
    daily.push(...rows)
    dayRowsMap.set(dayIso, rows)
  }

  // ---- customers ----------------------------------------------------------
  const names = namePool(rng, 240)
  const customers: CustomerRecord[] = names.map((name, i) => {
    const r = rng()
    const segment: Segment = r < 0.12 ? 'Enterprise' : r < 0.47 ? 'Mid-Market' : 'SMB'
    const region = weightedPick(rng, REGIONS as readonly Region[], REGIONS.map((rg) => REGION_CFG[rg].base))
    const sizeMult = segment === 'Enterprise' ? randBetween(rng, 8, 22) : segment === 'Mid-Market' ? randBetween(rng, 2.5, 8) : randBetween(rng, 0.4, 2.5)
    const lifetimeValue = Math.round(80e3 * sizeMult * randLognormal(rng, 0.35))
    const aov = Math.round((randBetween(rng, 220, 2400) * (segment === 'SMB' ? 0.5 : 1)) | 0)
    const ordersN = Math.max(3, Math.round(lifetimeValue / aov))
    const healthBase = segment === 'Enterprise' ? 78 : segment === 'Mid-Market' ? 68 : 58
    const healthScore = Math.round(clamp(healthBase + randGauss(rng, 0, 14), 28, 99))
    const recencyBias = healthScore > 70 ? 20 : healthScore > 50 ? 90 : 200
    const lastOrderDays = Math.round(clamp(Math.abs(randGauss(rng, 4, recencyBias / 4)), 0, 340))
    const churnRisk: CustomerRecord['churnRisk'] =
      healthScore < 52 || lastOrderDays > 120 ? 'high' : healthScore < 66 || lastOrderDays > 60 ? 'medium' : 'low'
    const status: CustomerRecord['status'] =
      lastOrderDays > 220 ? 'churned' : lastOrderDays > 110 ? 'dormant' : churnRisk === 'high' ? 'at_risk' : 'active'
    return {
      id: `CUS-${2100 + i}`,
      name,
      segment,
      region,
      since: t0.subtract(randInt(rng, 120, 1900), 'day').format('YYYY-MM-DD'),
      orders: ordersN,
      lifetimeValue,
      aov,
      lastOrderDays,
      healthScore,
      churnRisk,
      status,
    }
  })

  // Skew order-generation toward healthier, bigger accounts.
  const customerWeights = customers.map((c) => Math.pow(c.lifetimeValue, 0.5) * (c.status === 'churned' ? 0.02 : c.status === 'dormant' ? 0.15 : 1))

  // ---- SKUs ----------------------------------------------------------------
  const skus: SkuRecord[] = []
  let skuSeq = 4810
  for (const cat of CATEGORIES) {
    for (const skuName of SKU_NAMES[cat]) {
      const catIdx = CATEGORIES.indexOf(cat as Category)
      const price =
        catIdx === 2 || catIdx === 5 ? randBetween(rng, 18, 140) : catIdx === 0 || catIdx === 7 ? randBetween(rng, 90, 1450) : randBetween(rng, 35, 480)
      const cost = price * (1 - randBetween(rng, 0.22, 0.46))
      const dailyDemand = randBetween(rng, 0.8, 9) * (1 + catIdx * 0.04)
      const leadTimeDays = randInt(rng, 4, 32)
      const warehouseSet = shuffle(rng, WAREHOUSES).slice(0, randInt(rng, 2, 5))
      const stock = warehouseSet.map((w) => {
        const cover = clamp(Math.exp(randGauss(rng, 2.55, 0.85)), 0.4, 55) // days of cover — lognormal, occasionally tiny
        return { warehouse: w.code, qty: Math.round((dailyDemand / warehouseSet.length) * cover) }
      })
      skus.push({
        sku: `SKU-${skuSeq++}`,
        name: skuName,
        category: cat as Category,
        price: Math.round(price * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        supplier: randPick(rng, SUPPLIERS),
        leadTimeDays,
        dailyDemand: Math.round(dailyDemand * 10) / 10,
        reorderPoint: Math.ceil(dailyDemand * 5),
        stock,
      })
    }
  }

  // ---- reps ----------------------------------------------------------------
  const agentNames = peopleNames(rng, 24)
  const repNames = agentNames.slice(0, 16)
  const agents = agentNames.slice(16)
  const reps: RepRecord[] = repNames.map((name, i) => {
    const region = REGIONS[i % REGIONS.length]
    const quota = Math.round(randBetween(rng, 1.8e6, 4.4e6) / 1e4) * 1e4
    const attainmentPct = Math.round(clamp(86 + randGauss(rng, 4 + (region === 'APAC' ? 10 : 0), 16), 41, 142))
    return {
      name,
      region,
      quota,
      closedRevenue: Math.round((quota * attainmentPct) / 100),
      attainmentPct,
      openDeals: randInt(rng, 6, 44),
    }
  })

  // ---- orders (detail, last 91 days) ---------------------------------------
  const orders: OrderRecord[] = []
  let orderSeq = 24001
  for (let back = ORDER_LOOKBACK - 1; back >= 0; back--) {
    const dayIso = t0.subtract(back, 'day').format('YYYY-MM-DD')
    const rows = dayRowsMap.get(dayIso)!
    const dayTotal = rows.reduce((s, r) => s + r.orders, 0)
    const sampleN = Math.min(24, Math.round(dayTotal * 0.085) + 2)
    const weights = rows.map((r) => r.orders)

    for (let k = 0; k < sampleN; k++) {
      const src = weightedPick(rng, rows, weights)
      const region = src.region
      const channel = src.channel
      const rc = REGION_CFG[region]
      const hour = weightedPick(rng, HOURS, DAY_PROFILE)
      const created = dayjs(`${dayIso}T${hhmm(hour, randInt(rng, 0, 59))}`)

      const customer = weightedPick(rng, customers, customerWeights)
      const lines: OrderLine[] = []
      const lineCount = channel === 'Wholesale' ? randInt(rng, 3, 9) : randInt(rng, 1, 4)
      let value = 0
      for (let li = 0; li < lineCount; li++) {
        const sku = randPick(rng, skus)
        const qty = channel === 'Wholesale' ? randInt(rng, 5, 60) : randInt(rng, 1, 6)
        const discount = customer.segment === 'Enterprise' ? randBetween(rng, 0.06, 0.18) : randBetween(rng, 0, 0.05)
        const unitPrice = Math.round(sku.price * (1 - discount) * 100) / 100
        value += qty * unitPrice
        lines.push({ sku: sku.sku, name: sku.name, qty, unitPrice })
      }

      const promiseDays = rc.promiseDays + (channel === 'Wholesale' ? 1 : 0)
      const promiseDate = created.add(promiseDays, 'day')
      let status: OrderStatus
      let delayReason: string | undefined
      let shippedAt: string | undefined
      let deliveredAt: string | undefined

      const roll = rng()
      if (back > 3 && roll < 0.025) {
        status = 'cancelled'
      } else if (back === 0) {
        status = rng() < 0.45 ? 'pending' : 'picking'
      } else if (back === 1) {
        status = rng() < 0.55 ? 'picking' : 'in_transit'
        if (status === 'in_transit') shippedAt = created.add(randInt(rng, 14, 40), 'hour').toISOString()
      } else if (back <= promiseDays - 1) {
        status = 'in_transit'
        shippedAt = created.add(randInt(rng, 8, 34), 'hour').toISOString()
      } else {
        const lateShare = clamp(0.075 * rc.lateMod, 0.03, 0.25)
        if (rng() < 0.035) {
          status = 'returned'
          shippedAt = created.add(randInt(rng, 8, 30), 'hour').toISOString()
          deliveredAt = promiseDate.subtract(randInt(rng, 0, 1), 'day').format('YYYY-MM-DD') + 'T10:00:00.000Z'
        } else if (rng() < lateShare) {
          status = 'delayed'
          delayReason = randPick(rng, DELAY_REASONS)
          shippedAt = created.add(randInt(rng, 10, 40), 'hour').toISOString()
        } else {
          status = 'delivered'
          const took = randInt(rng, 2, Math.max(3, promiseDays - 1))
          shippedAt = created.add(randInt(rng, 6, 26), 'hour').toISOString()
          deliveredAt = created.add(took, 'day').format('YYYY-MM-DD') + 'T12:00:00.000Z'
        }
      }

      orders.push({
        id: `ORD-${orderSeq++}`,
        createdAt: created.toISOString(),
        day: dayIso,
        region,
        channel,
        warehouse: randPick(rng, WAREHOUSES.filter((w) => w.region === region)).code,
        customerId: customer.id,
        customer: customer.name,
        segment: customer.segment,
        rep: randPick(rng, repNames),
        status,
        value: Math.round(value * 100) / 100,
        itemCount: lines.reduce((s, l) => s + l.qty, 0),
        lines,
        promiseDate: promiseDate.format('YYYY-MM-DD'),
        shippedAt,
        deliveredAt,
        carrier: randPick(rng, COURIERS),
        delayReason,
        priorityRush: customer.segment === 'Enterprise' && rng() < 0.3,
      })
    }
  }

  // ---- tickets (detail, last 60 days + live tail) ---------------------------
  const tickets: TicketRecord[] = []
  const hourlyByDow: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  let ticketSeq = 5201

  const priorityWeights = [0.07, 0.21, 0.46, 0.26]
  const PRIO: Priority[] = ['critical', 'high', 'medium', 'low']

  const mkTicket = (createdAt: dayjs.Dayjs): void => {
    const ageMin = Math.max(2, now.diff(createdAt, 'minute'))
    const customer = weightedPick(rng, customers, customerWeights)
    const priority = weightedPick(rng, PRIO, priorityWeights)
    const slaH = SLA_HOURS[priority]
    const tag = randPick(rng, TICKET_TAGS)
    const subject = randPick(rng, TICKET_SUBJECTS[tag])
    const frCapMin = { critical: 25, high: 55, medium: 160, low: 420 }[priority]
    const firstResponseAt = ageMin > randInt(rng, 8, frCapMin) ? createdAt.add(randInt(rng, 6, frCapMin), 'minute') : null
    const canResolve = ageMin > 60 * 2
    let resolvedAt: dayjs.Dayjs | null = null
    if (canResolve && rng() < 0.86) {
      const resolveMin = Math.round(slaH * 60 * randBetween(rng, 0.3, 1.55))
      if (resolveMin < ageMin) resolvedAt = createdAt.add(resolveMin, 'minute')
    }
    const openPastDue = now.diff(createdAt, 'hour') > slaH
    const breached = resolvedAt ? resolvedAt.diff(createdAt, 'hour') > slaH || (firstResponseAt ? firstResponseAt.diff(createdAt, 'minute') > slaH * 60 : openPastDue) : openPastDue
    const status: TicketRecord['status'] = resolvedAt
      ? 'resolved'
      : firstResponseAt
        ? rng() < 0.18
          ? 'waiting_customer'
          : 'in_progress'
        : 'open'

    const dowIdx = (createdAt.day() + 6) % 7
    hourlyByDow[dowIdx][createdAt.hour()] += 1

    tickets.push({
      id: `TCK-${ticketSeq++}`,
      subject,
      customerId: customer.id,
      customer: customer.name,
      region: customer.region,
      priority,
      status,
      tag,
      agent: randPick(rng, agents),
      createdAt: createdAt.toISOString(),
      firstResponseAt: firstResponseAt ? firstResponseAt.toISOString() : undefined,
      resolvedAt: resolvedAt ? resolvedAt.toISOString() : undefined,
      slaHours: slaH,
      breached,
    })
  }

  for (let back = TICKET_LOOKBACK - 1; back >= 0; back--) {
    const dayT = t0.subtract(back, 'day')
    const dow = dayT.day()
    const n = dow === 0 || dow === 6 ? randInt(rng, 1, 4) : randInt(rng, 5, 11)
    for (let k = 0; k < n; k++) {
      const hour = weightedPick(rng, HOURS, DAY_PROFILE)
      const created = dayT.hour(hour).minute(randInt(rng, 0, 59))
      if (back === 0 && created.isAfter(now)) continue
      mkTicket(created)
    }
  }
  // A busy live tail so "today" and the last few hours feel alive.
  for (let k = 0; k < 26; k++) {
    const created = now.subtract(randInt(rng, 3, 13 * 60), 'minute')
    mkTicket(created)
  }

  // ---- alerts / activity -----------------------------------------------------
  const alerts: AlertRecord[] = []
  let alertSeq = 1
  const pushAlert = (
    severity: AlertRecord['severity'],
    title: string,
    body: string,
    link: string | undefined,
    hoursAgo: number,
  ) => {
    alerts.push({
      id: `ALR-${alertSeq++}`,
      at: now.subtract(Math.round(hoursAgo * 60), 'minute').toISOString(),
      severity,
      title,
      body,
      link,
    })
  }

  const lowStockSkus = skus
    .map((s) => ({ s, total: s.stock.reduce((a, b) => a + b.qty, 0) }))
    .filter((x) => x.total / s_dailyDemand(x.s) < x.s.leadTimeDays)
    .slice(0, 5)
  for (const { s } of lowStockSkus) {
    pushAlert('warning', `Cover below lead time — ${s.name}`, `${s.sku} has ~${Math.round(totalCover(s))}d of stock vs a ${s.leadTimeDays}d supplier lead time. Raise a PO.`, '/inventory', randBetween(rng, 1, 20))
  }
  pushAlert('critical', 'On-time delivery dipped in EMEA', 'BER outbound late share hit 21% after a carrier disruption. Expedite list is 34 orders.', '/support', randBetween(rng, 2, 7))
  const critBreach = tickets.filter((t) => t.priority === 'critical' && t.breached && !t.resolvedAt).slice(0, 2)
  for (const t of critBreach) {
    pushAlert('critical', `SLA breach — ${t.id}`, `${t.subject} (${t.customer}) is past its ${t.slaHours}h window and still ${t.status.replace('_', ' ')}.`, '/support', randBetween(rng, 1, 10))
  }
  const lastDayRows = dayRowsMap.get(dayjs(t0).format('YYYY-MM-DD')) ?? []
  const yday = dayRowsMap.get(t0.subtract(1, 'day').format('YYYY-MM-DD')) ?? []
  const revLast = lastDayRows.reduce((s, r) => s + r.revenue, 0)
  const revPrev = yday.reduce((s, r) => s + r.revenue, 0)
  pushAlert(
    revLast >= revPrev ? 'success' : 'info',
    'Yesterday revenue closed ' + (revPrev > 0 ? `${revLast >= revPrev ? '+' : ''}${(((revLast - revPrev) / revPrev) * 100).toFixed(1)}%` : 'flat'),
    `D-1 revenue ${fmtMoneyRough(revLast)} vs ${fmtMoneyRough(revPrev)} prior day, ${fmtIntRough(yday.reduce((s, r) => s + r.orders, 0))} orders.`,
    '/',
    randBetween(rng, 16, 22),
  )
  pushAlert('info', 'Weekly replenishment cycle complete', 'Auto-PO suggestions generated for 18 SKUs across ORD and BER. Awaiting buyer approval.', '/inventory', randBetween(rng, 20, 30))
  pushAlert('success', 'APAC growth checkpoint', 'APAC revenue is pacing +46% YoY, the strongest region for six straight months.', '/customers', randBetween(rng, 5, 26))

  alerts.sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    seed,
    today: t0.format('YYYY-MM-DD'),
    generatedAt: now.toISOString(),
    startDay: start.format('YYYY-MM-DD'),
    daily,
    orders,
    tickets,
    skus,
    customers,
    reps,
    warehouses: WAREHOUSES,
    suppliers: SUPPLIERS,
    alerts,
    hourlyByDow,
  }
}

/* local helpers for alerts (kept private) */
function s_dailyDemand(s: SkuRecord): number {
  return Math.max(0.2, s.dailyDemand)
}
function totalCover(s: SkuRecord): number {
  return s.stock.reduce((a, b) => a + b.qty, 0) / s_dailyDemand(s)
}
function fmtMoneyRough(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${Math.round(n)}`
}
function fmtIntRough(n: number): string {
  return Intl.NumberFormat('en-US').format(n)
}
