import { getProduct, PRODUCT_MODES, PRODUCTS, type ProductMode } from '../../../shared/products'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import { productModes } from '../../../server/products'
import type { Env } from '../../../server/types'

/** Per product: te koop, uitverkocht, gesloten of verborgen. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const modes = await productModes(env)
  return json({
    products: PRODUCTS.map((p) => ({ productId: p.id, mode: modes.get(p.id) ?? 'sale' })),
  })
}

type Body = { productId?: string; mode?: string }

/** Status van een product zetten. Bestaande bestellingen blijven gewoon geldig. */
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
  if (!PRODUCT_MODES.includes(body.mode as ProductMode)) return err('Ongeldige status.')

  // `enabled` is de oude kolom (0015); we schrijven hem mee zodat hij klopt.
  await env.DB.prepare(
    `INSERT INTO product_settings (product_id, enabled, mode, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (product_id) DO UPDATE SET
       enabled = excluded.enabled, mode = excluded.mode,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(body.productId, body.mode === 'hidden' ? 0 : 1, body.mode, Date.now(), email)
    .run()
  return json({ ok: true })
}
