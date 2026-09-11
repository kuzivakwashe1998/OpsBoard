import { Boxes, FileBarChart2, LayoutDashboard, LifeBuoy, ShoppingCart, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  blurb: string
  group: 'Operate' | 'Grow' | 'Report'
}

export const NAV: NavItem[] = [
  { path: '/', label: 'Overview', icon: LayoutDashboard, blurb: 'Executive read on the whole operation', group: 'Operate' },
  { path: '/orders', label: 'Orders & Fulfillment', icon: ShoppingCart, blurb: 'Every order, promise dates and exceptions', group: 'Operate' },
  { path: '/inventory', label: 'Inventory', icon: Boxes, blurb: 'Stock cover, risk and replenishment', group: 'Operate' },
  { path: '/support', label: 'Support & SLA', icon: LifeBuoy, blurb: 'Ticket load, response times and breaches', group: 'Operate' },
  { path: '/customers', label: 'Customers & Reps', icon: Users, blurb: 'Accounts, risk and sales performance', group: 'Grow' },
  { path: '/reports', label: 'Reports', icon: FileBarChart2, blurb: 'One-page briefs, export and print', group: 'Report' },
]

export const titleForPath = (path: string): NavItem | undefined =>
  NAV.find((n) => (n.path === '/' ? path === '/' : path.startsWith(n.path)))
