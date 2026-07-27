import { getProduct } from '../../../shared/products'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

type Body = { itemId?: number; customName?: string; size?: string }

/** Polo-opdruk of maat corrigeren (typefoutje van de koper). */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const customName = body.customName?.trim() ?? ''
  const size = body.size?.trim() ?? ''
  if (!Number.isInteger(body.itemId)) return err('Ongeldige aanvraag.')
  if (customName.length < 2 || customName.length > 20) return err('Opdruk: 2 tot 20 tekens.')

  const row = await env.DB.prepare(
    `SELECT product_id AS productId FROM order_items WHERE rowid = ? AND custom_name IS NOT NULL`,
  )
    .bind(body.itemId)
    .first<{ productId: string }>()
  if (!row) return err('Orderregel niet gevonden.', 404)

  const product = getProduct(row.productId)
  if (size && !(product?.sizes ?? []).includes(size)) return err('Ongeldige maat.')

  await env.DB.prepare(
    `UPDATE order_items SET custom_name = ?, size = coalesce(nullif(?, ''), size) WHERE rowid = ?`,
  )
    .bind(customName, size, body.itemId)
    .run()
  return json({ ok: true })
}
