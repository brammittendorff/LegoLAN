import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

type Body = { orderId?: string; action?: string }

/**
 * Admin-actie op een bestelling. Alleen 'cancel' op een pending order:
 * betaalde orders wijzig je niet - terugbetalen gaat via het Mollie-dashboard.
 */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }
  if (!body.orderId || body.action !== 'cancel') return err('Ongeldige aanvraag.')

  const result = await env.DB.prepare(
    `UPDATE orders SET status = 'canceled' WHERE id = ? AND status = 'pending'`,
  )
    .bind(body.orderId)
    .run()
  if (result.meta.changes === 0) {
    return err('Alleen pending bestellingen kunnen geannuleerd worden.', 409)
  }
  return json({ ok: true })
}
