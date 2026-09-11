import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Channel, Region } from '../data/model'
import type { DayRange } from '../lib/dates'

export interface Toast {
  id: number
  kind: 'success' | 'info' | 'error'
  title: string
  body?: string
}

export interface LiveEvent {
  id: number
  at: string
  kind: 'order' | 'ticket_resolved' | 'ticket_opened' | 'shipment' | 'stock'
  text: string
  region: Region
  channel: Channel
  revenue?: number
  ticket?: boolean
  stockAlert?: boolean
}

export interface LivePatch {
  day: string
  region: Region
  channel: Channel
  orders: number
  revenue: number
  cogs: number
  ticketsOpened: number
  ticketsResolved: number
}

interface AppState {
  // filters
  preset: string
  customRange: DayRange | null
  region: Region | 'all'
  channel: Channel | 'all'
  compare: boolean
  // ui
  theme: 'light' | 'dark'
  live: boolean
  paletteOpen: boolean
  liveEvents: LiveEvent[]
  livePatch: LivePatch[]
  toasts: Toast[]
  // actions
  setPreset: (p: string) => void
  setCustomRange: (r: DayRange | null) => void
  setRegion: (r: Region | 'all') => void
  setChannel: (c: Channel | 'all') => void
  setCompare: (v: boolean) => void
  setTheme: (t: 'light' | 'dark') => void
  setPaletteOpen: (v: boolean) => void
  toggleLive: () => void
  addLiveEvent: (e: Omit<LiveEvent, 'id'>) => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  resetView: () => void
}

let toastSeq = 1
let liveSeq = 1

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      preset: '30d',
      customRange: null,
      region: 'all',
      channel: 'all',
      compare: true,

      theme: 'light',
      live: false,
      paletteOpen: false,
      liveEvents: [],
      livePatch: [],
      toasts: [],

      setPreset: (preset) => set({ preset }),
      setCustomRange: (customRange) => set({ preset: customRange ? 'custom' : '30d', customRange }),
      setRegion: (region) => set({ region }),
      setChannel: (channel) => set({ channel }),
      setCompare: (compare) => set({ compare }),
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

      toggleLive: () => {
        const next = !get().live
        set(next ? { live: true, liveEvents: [], livePatch: [] } : { live: false })
        get().pushToast({
          kind: next ? 'success' : 'info',
          title: next ? 'Live simulation on' : 'Live simulation paused',
          body: next
            ? 'New events will stream in every few seconds and patch today’s KPIs.'
            : 'Today’s numbers revert to the generated dataset.',
        })
      },

      addLiveEvent: (e) =>
        set((s) => {
          const event: LiveEvent = { ...e, id: liveSeq++ }
          const events = [event, ...s.liveEvents].slice(0, 40)
          if (!event.revenue && !event.ticket) return { liveEvents: events }
          const patch: LivePatch = {
            day: event.at.slice(0, 10),
            region: event.region,
            channel: event.channel,
            orders: event.kind === 'order' ? 1 : 0,
            revenue: event.revenue ?? 0,
            cogs: (event.revenue ?? 0) * 0.66,
            ticketsOpened: event.ticket && event.kind !== 'ticket_resolved' ? 1 : 0,
            ticketsResolved: event.kind === 'ticket_resolved' ? 1 : 0,
          }
          const livePatch = [...s.livePatch, patch]
          return { liveEvents: events, livePatch }
        }),

      pushToast: (t) => {
        const id = toastSeq++
        set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }))
        setTimeout(() => get().dismissToast(id), 4200)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      resetView: () => set({ preset: '30d', customRange: null, region: 'all', channel: 'all', compare: true }),
    }),
    {
      name: 'opsboard-ui',
      storage: {
        getItem: (name) => {
          try {
            return JSON.parse(localStorage.getItem(name) ?? 'null')
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value))
          } catch {
            /* private mode etc. */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name)
          } catch {
            /* noop */
          }
        },
      },
      partialize: (s) => ({ theme: s.theme, compare: s.compare, live: false }) as AppState,
    },
  ),
)
