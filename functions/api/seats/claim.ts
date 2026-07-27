import { EDITION_YEAR } from '../../../shared/products'
import { seatKinds } from '../../../shared/seatmap'
import { err, json } from '../../../server/http'
import { getOrder, getOrderItems, seatQuota } from '../../../server/orders'
import type { Env } from '../../../server/types'

type Body = { orderId?: string; seatId?: string; nickname?: string }

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

  const kind = seatKinds().get(seatId)
  if (!kind) return err('Die plek bestaat niet. Netjes proberen.')

  const order = await getOrder(env, orderId)
  if (!order) return err('Bestelling niet gevonden.', 404)
  if (order.status !== 'paid') return err('Eerst betalen, dan pas een plekje uitzoeken. 😏', 403)

  const items = await getOrderItems(env, orderId)
  const quota = seatQuota(items)

  const claimed = await env.DB.prepare(`SELECT seat_id AS seatId FROM seats WHERE order_id = ?`)
    .bind(orderId)
    .all<{ seatId: string }>()
  const kinds = seatKinds()
  let used = 0
  for (const row of claimed.results) {
    if (kinds.get(row.seatId) === kind) used += 1
  }
  if (used >= quota[kind]) {
    return err(
      kind === 'dayseat'
        ? 'Je hebt geen dagticket (meer) om een dagplek mee te claimen.'
        : 'Alle plekken van deze bestelling zijn al geclaimd.',
      403,
    )
  }

  try {
    await env.DB.prepare(
      `INSERT INTO seats (edition, seat_id, order_id, nickname, claimed_at) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(EDITION_YEAR, seatId, orderId, nickname, Date.now())
      .run()
  } catch (e) {
    if (String(e).includes('UNIQUE') || String(e).includes('PRIMARY KEY')) {
      return err('Deze plek is nét ingepikt. Kies een andere.', 409)
    }
    throw e
  }

  return json({ ok: true })
}
