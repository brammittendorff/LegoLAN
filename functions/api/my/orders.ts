import { EDITION_YEAR } from '../../../shared/products'
import { emailFromRequest, emailsFor } from '../../../server/auth'
import { err, json } from '../../../server/http'
import { getOrderItems, seatQuota } from '../../../server/orders'
import type { Env } from '../../../server/types'

/**
 * De betaalde bestellingen van de ingelogde bezoeker voor deze editie,
 * met plek-quotum en geclaimde plekken. De plattegrond werkt hierop, zodat
 * er nooit een order van een ander account "blijft plakken".
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email) return err('Niet ingelogd.', 401)

  const emails = await emailsFor(env, email)
  const rows = await env.DB.prepare(
    `SELECT id FROM orders
      WHERE status = 'paid' AND edition = ? AND lower(email) IN (${emails.map(() => '?').join(',')})
      ORDER BY created_at`,
  )
    .bind(EDITION_YEAR, ...emails)
    .all<{ id: string }>()

  const orders = []
  for (const row of rows.results) {
    const items = await getOrderItems(env, row.id)
    const quota = seatQuota(items)
    if (quota === 0) continue
    const seats = await env.DB.prepare(
      `SELECT seat_id AS seatId, nickname, owner_email AS ownerEmail
         FROM seats WHERE order_id = ? AND edition = ?`,
    )
      .bind(row.id, EDITION_YEAR)
      .all<{ seatId: string; nickname: string; ownerEmail: string | null }>()
    orders.push({ id: row.id, seatQuota: quota, seatsClaimed: seats.results })
  }

  return json({ orders })
}
