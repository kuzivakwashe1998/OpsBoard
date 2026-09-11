import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { OverviewPage } from './pages/OverviewPage'
import { OrdersPage } from './pages/OrdersPage'
import { InventoryPage } from './pages/InventoryPage'
import { SupportPage } from './pages/SupportPage'
import { CustomersPage } from './pages/CustomersPage'
import { ReportsPage } from './pages/ReportsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
