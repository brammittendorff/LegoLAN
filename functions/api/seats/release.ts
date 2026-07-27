import { EDITION_YEAR } from '../../../shared/products'
import { err, json } from '../../../server/http'
import { getOrder } from '../../../server/orders'
import type { Env } from '../../../server/types'

type Body = { orderId?: string; seatId?: string }

/**
 * Eigen plek vrijgeven (verkeerd geklikt): wie het order-id kent (de koper,
 * via mail/bedankt-pagina) mag de plek van die bestelling weer loslaten.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }
  const { orderId, seatId } = body
  if (!orderId || !seatId) return err('Ongeldige aanvraag.')

  const order = await getOrder(env, orderId)
  if (!order) return err('Bestelling niet gevonden.', 404)

  const result = await env.DB.prepare(
    `DELETE FROM seats WHERE edition = ? AND seat_id = ? AND order_id = ?`,
  )
    .bind(EDITION_YEAR, seatId, orderId)
    .run()
  if (result.meta.changes === 0) {
    return err('Deze plek hoort niet bij jouw bestelling.', 403)
  }
  return json({ ok: true })
}
