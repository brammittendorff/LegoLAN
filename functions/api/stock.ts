import { CAPACITY_POOLS, EVENT_DAYS, PRODUCTS } from '../../shared/products'
import { json } from '../../server/http'
import { bookedPerPoolDay, expireStalePending, soldCounts } from '../../server/orders'
import type { Env } from '../../server/types'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  await expireStalePending(env)
  const sold = await soldCounts(env)
  const booked = await bookedPerPoolDay(env)

  const stock: Record<string, number | null> = {}
  for (const product of PRODUCTS) {
    if (product.pool && product.perDay) {
      // Gunstigste dag telt voor de "nog X beschikbaar"-badge.
      const cap = CAPACITY_POOLS[product.pool] ?? 0
      const best = Math.max(...EVENT_DAYS.map((d) => cap - (booked[`${product.pool}:${d}`] ?? 0)))
      stock[product.id] = Math.max(0, best)
    } else {
      stock[product.id] =
        product.capacity === null ? null : Math.max(0, product.capacity - (sold[product.id] ?? 0))
    }
  }
  return json({ stock })
}
