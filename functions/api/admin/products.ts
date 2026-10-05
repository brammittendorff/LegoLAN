import { getProduct, PRODUCTS } from '../../../shared/products'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import { disabledProductIds } from '../../../server/products'
import type { Env } from '../../../server/types'

/** Welke producten staan aan of uit in de shop. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const disabled = await disabledProductIds(env)
  return json({
    products: PRODUCTS.map((p) => ({ productId: p.id, enabled: !disabled.has(p.id) })),
  })
}

type Body = { productId?: string; enabled?: boolean }

/** Product aan/uit zetten. Bestaande bestellingen blijven gewoon geldig. */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }
  if (!body.productId || !getProduct(body.productId)) return err('Onbekend product.')
  if (typeof body.enabled !== 'boolean') return err('Ongeldige aanvraag.')

  await env.DB.prepare(
    `INSERT INTO product_settings (product_id, enabled, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (product_id) DO UPDATE SET
       enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(body.productId, body.enabled ? 1 : 0, Date.now(), email)
    .run()
  return json({ ok: true })
}
