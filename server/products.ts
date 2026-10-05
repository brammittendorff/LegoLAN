import type { Env } from './types'

/** Product-id's die de admin heeft uitgezet (zie migrations/0015_product_settings.sql). */
export async function disabledProductIds(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    `SELECT product_id AS productId FROM product_settings WHERE enabled = 0`,
  ).all<{ productId: string }>()
  return new Set(results.map((r) => r.productId))
}
