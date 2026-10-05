import type { ProductMode } from '../shared/products'
import type { Env } from './types'

/**
 * Producten die de admin niet op 'te koop' heeft staan (zie
 * migrations/0016_product_mode.sql). Ontbreekt een product, dan is het te koop.
 */
export async function productModes(env: Env): Promise<Map<string, ProductMode>> {
  const { results } = await env.DB.prepare(
    `SELECT product_id AS productId, mode FROM product_settings WHERE mode != 'sale'`,
  ).all<{ productId: string; mode: ProductMode }>()
  return new Map(results.map((r) => [r.productId, r.mode]))
}
