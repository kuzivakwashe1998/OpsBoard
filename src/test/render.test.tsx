import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { OverviewPage } from '../pages/OverviewPage'
import { OrdersPage } from '../pages/OrdersPage'
import { InventoryPage } from '../pages/InventoryPage'
import { SupportPage } from '../pages/SupportPage'
import { CustomersPage } from '../pages/CustomersPage'
import { ReportsPage } from '../pages/ReportsPage'

function renderApp(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('smoke render — every page mounts under the shell', () => {
  it('overview', () => {
    renderApp('/')
    expect(screen.getByText('Total revenue', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/Ops brief/i)).toBeInTheDocument()
    expect(screen.getByText(/What needs attention/i)).toBeInTheDocument()
  })

  it('orders', () => {
    renderApp('/orders')
    expect(screen.getByText('Order book')).toBeInTheDocument()
    expect(screen.getAllByText(/Orders in window/i).length).toBeGreaterThan(0)
  })

  it('inventory', () => {
    renderApp('/inventory')
    expect(screen.getByText('SKU ledger')).toBeInTheDocument()
    expect(screen.getByText('Replenishment queue')).toBeInTheDocument()
  })

  it('support', () => {
    renderApp('/support')
    expect(screen.getByText('Ticket desk')).toBeInTheDocument()
    expect(screen.getByText('Agent leaderboard')).toBeInTheDocument()
  })

  it('customers', () => {
    renderApp('/customers')
    expect(screen.getByText('Account book')).toBeInTheDocument()
    expect(screen.getByText(/quota attainment/i)).toBeInTheDocument()
  })

  it('reports', () => {
    renderApp('/reports')
    expect(screen.getByText('1 · Pick a template')).toBeInTheDocument()
    expect(screen.getAllByText(/Executive summary/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Print \/ PDF/i)).toBeInTheDocument()
  })
})
