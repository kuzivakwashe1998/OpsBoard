import { useState } from 'react'
import { Menu, Moon, Search, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { titleForPath } from './nav'
import { SidebarContent } from './Sidebar'
import { useStore } from '../../state/store'
import { Sheet } from '../ui/Sheet'
import { Kbd } from '../ui/primitives'
import { fmtDay } from '../../lib/format'
import { getDataset } from '../../data/dataset'

export function Topbar() {
  const location = useLocation()
  const page = titleForPath(location.pathname)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const setPalette = useStore((s) => s.setPaletteOpen)
  const [mobileNav, setMobileNav] = useState(false)
  const ds = getDataset()

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 lg:px-6">
      <button
        type="button"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
        onClick={() => setMobileNav(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold tracking-tight">{page?.label ?? 'OpsBoard'}</h1>
        <p className="muted -mt-0.5 hidden truncate text-[11px] sm:block">{page?.blurb}</p>
      </div>

      <div className="muted hidden items-center gap-1.5 text-[11px] font-medium xl:flex">
        <span>Data through</span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {fmtDay(ds.today, 'medium')}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setPalette(true)}
        className="hidden items-center gap-2 rounded-lg border border-slate-300/80 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 md:flex dark:border-slate-700 dark:bg-slate-800/70 dark:hover:text-slate-300"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        Search orders, SKUs, pages…
        <span className="flex gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <button
        type="button"
        className="rounded-lg border border-slate-300/80 p-1.5 text-slate-500 transition-colors hover:bg-slate-100 md:hidden dark:border-slate-700 dark:hover:bg-slate-800"
        onClick={() => setPalette(true)}
        aria-label="Open search"
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="rounded-lg border border-slate-300/80 p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-[11px] font-bold text-white shadow-sm ring-2 ring-white/70 dark:ring-slate-900" title="Signed in as Ops Manager">
        OM
      </div>

      <Sheet open={mobileNav} onClose={() => setMobileNav(false)} title="Navigate" subtitle="OpsBoard">
        <SidebarContent onNavigate={() => setMobileNav(false)} />
      </Sheet>
    </header>
  )
}
