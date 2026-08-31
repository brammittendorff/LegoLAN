import {
  CAPACITY_POOLS,
  EDITION_YEAR,
  EVENT_DAYS,
  PRODUCTS,
  SEATS_TOTAL,
  seatsFromSold,
} from '../../shared/products'
import { json } from '../../server/http'
import { bookedPerPoolDay, expireStalePending, soldCounts } from '../../server/orders'
import type { Env } from '../../server/types'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  await expireStalePending(env)
  const sold = await soldCounts(env)
  const booked = await bookedPerPoolDay(env)

  // Plekken die de admin los heeft toegewezen horen ook bij de bezetting:
  // die stoelen zijn weg, ook zonder bestelling.
  const losseplekken = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM seats WHERE edition = ? AND order_id IS NULL`,
  )
    .bind(EDITION_YEAR)
    .first<{ n: number }>()
  const zaalVrij = Math.max(0, SEATS_TOTAL - seatsFromSold(sold) - (losseplekken?.n ?? 0))

  const stock: Record<string, number | null> = {}
  // Per eventdag, voor wat écht per dag geboekt wordt (de huur-PC's).
  const perDay: Record<string, Record<string, number>> = {}
  for (const product of PRODUCTS) {
    if (product.type === 'ticket') {
      // Elk ticket kost één stoel voor de hele editie, weekend of dag.
      stock[product.id] = zaalVrij
    } else if (product.pool) {
      const cap = CAPACITY_POOLS[product.pool] ?? 0
      const vrijPerDag = EVENT_DAYS.map((d) => cap - (booked[`${product.pool}:${d}`] ?? 0))
      stock[product.id] = Math.max(0, Math.max(...vrijPerDag))
      perDay[product.id] = Object.fromEntries(
        EVENT_DAYS.map((d, i) => [d, Math.max(0, vrijPerDag[i])]),
      )
    } else {
      stock[product.id] =
        product.capacity === null ? null : Math.max(0, product.capacity - (sold[product.id] ?? 0))
    }
  }
  return json({ stock, perDay })
}
