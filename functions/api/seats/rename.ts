import { EDITION_YEAR } from '../../../shared/products'
import { err, json } from '../../../server/http'
import { getOrder } from '../../../server/orders'
import type { Env } from '../../../server/types'

type Body = { orderId?: string; seatId?: string; nickname?: string }

/**
 * De naam op een eigen plek aanpassen. Wie meerdere plekken claimt (voor
 * vrienden of het gezin) zet er per plek een andere naam op.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const { orderId, seatId } = body
  const nickname = body.nickname?.trim() ?? ''
  if (!orderId || !seatId) return err('Ongeldige aanvraag.')
  if (nickname.length < 2 || nickname.length > 20) {
    return err('Kies een naam van 2 tot 20 tekens.')
  }

  const order = await getOrder(env, orderId)
  if (!order) return err('Bestelling niet gevonden.', 404)

  const result = await env.DB.prepare(
    `UPDATE seats SET nickname = ? WHERE edition = ? AND seat_id = ? AND order_id = ?`,
  )
    .bind(nickname, EDITION_YEAR, seatId, orderId)
    .run()
  if (result.meta.changes === 0) {
    return err('Deze plek hoort niet bij jouw bestelling.', 403)
  }
  return json({ ok: true })
}
