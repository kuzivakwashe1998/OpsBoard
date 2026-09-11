import { useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { useStore } from '../../state/store'
import { getDataset } from '../../data/dataset'
import { CHANNELS, REGIONS } from '../../data/model'

/**
 * Streams simulated events every few seconds while live mode is on:
 * orders, ticket churn, shipments and stock alerts. Each event patches the
 * store overlay that feeds today's aggregates.
 */
export function useLiveEngine() {
  const live = useStore((s) => s.live)
  const addLiveEvent = useStore((s) => s.addLiveEvent)
  const tick = useRef(0)

  useEffect(() => {
    if (!live) return
    const ds = getDataset()
    const timer = window.setInterval(() => {
      tick.current += 1
      const roll = Math.random()
      const region = REGIONS[Math.floor(Math.random() * REGIONS.length)]
      const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)]
      const at = dayjs().toISOString()
      if (roll < 0.42) {
        const value = Math.round(120 + Math.random() * 5400)
        addLiveEvent({ at, kind: 'order', region, channel, revenue: value, text: `${channel} order — ${value.toLocaleString()} from a ${region} account` })
      } else if (roll < 0.62) {
        addLiveEvent({ at, kind: 'ticket_opened', region, channel, ticket: true, text: `Ticket opened — delivery status question` })
      } else if (roll < 0.82) {
        addLiveEvent({ at, kind: 'ticket_resolved', region, channel, ticket: true, text: `Ticket resolved by agent in ${(2 + Math.random() * 40).toFixed(0)}m` })
      } else if (roll < 0.94) {
        const wh = ds.warehouses.filter((w) => w.region === region)[0] ?? ds.warehouses[0]
        addLiveEvent({ at, kind: 'shipment', region, channel, text: `Wave dispatched from ${wh.code} — ${(4 + Math.floor(Math.random() * 30))} pallets` })
      } else {
        const sku = ds.skus[Math.floor(Math.random() * ds.skus.length)]
        addLiveEvent({ at, kind: 'stock', region, channel, stockAlert: true, text: `Low stock flag — ${sku.sku} ${sku.name}` })
      }
    }, 3800)
    return () => window.clearInterval(timer)
  }, [live, addLiveEvent])
}
