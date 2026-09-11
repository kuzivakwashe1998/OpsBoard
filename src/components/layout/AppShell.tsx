import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { FilterBar } from './FilterBar'
import { CommandPalette } from './CommandPalette'
import { useLiveEngine } from './useLiveEngine'
import { Toaster } from '../ui/Toaster'
import { useStore } from '../../state/store'

export function AppShell() {
  const theme = useStore((s) => s.theme)
  useLiveEngine()

  // keep <html> class in sync with persisted theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <Sidebar />
      <div id="main-scroll" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar />
        <FilterBar />
        <main className="mx-auto w-full max-w-[1560px] flex-1 px-4 pt-4 pb-10 lg:px-6">
          <Outlet />
        </main>
        <footer className="muted no-print border-t border-slate-200/70 px-6 py-3 text-[10.5px] dark:border-slate-800">
          <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-2">
            <span>OpsBoard · synthetic operations dataset · metrics computed client-side</span>
            <span className="hidden sm:inline">All figures simulated — swap the data layer for your warehouse to go live.</span>
          </div>
        </footer>
      </div>
      <Toaster />
      <CommandPalette />
    </div>
  )
}
