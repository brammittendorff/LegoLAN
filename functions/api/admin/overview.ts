import { EDITION_YEAR } from '../../../shared/products'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

/** Alles wat een vrijwilliger wil zien, in één call. Alleen voor admins. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const orders = await env.DB.prepare(
    `SELECT o.id, o.created_at AS createdAt, o.name, o.email, o.amount_cents AS amountCents,
            o.status,
            group_concat(oi.qty || 'x ' || oi.product_id ||
              coalesce(' (' || oi.size || ')', '') ||
              coalesce(' "' || oi.custom_name || '"', ''), ', ') AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.edition = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 300`,
  )
    .bind(EDITION_YEAR)
    .all()

  const stats = await env.DB.prepare(
    `SELECT oi.product_id AS productId, SUM(oi.qty) AS sold,
            SUM(oi.qty * oi.price_cents) AS revenueCents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid' AND o.edition = ?
      GROUP BY oi.product_id`,
  )
    .bind(EDITION_YEAR)
    .all()

  const seats = await env.DB.prepare(
    `SELECT s.seat_id AS seatId, s.nickname,
            COALESCE(o.name, trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))) AS name,
            COALESCE(o.email, s.owner_email) AS email,
            s.order_id IS NULL AS assigned
       FROM seats s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN users u ON u.email = s.owner_email
      WHERE s.edition = ?
      ORDER BY s.claimed_at`,
  )
    .bind(EDITION_YEAR)
    .all()

  const polos = await env.DB.prepare(
    `SELECT oi.rowid AS itemId, o.name, o.email, oi.size, oi.custom_name AS customName, oi.qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid' AND oi.custom_name IS NOT NULL AND o.edition = ?
      ORDER BY o.created_at`,
  )
    .bind(EDITION_YEAR)
    .all()

  const attendees = await env.DB.prepare(
    `SELECT edition, COUNT(*) AS n FROM attendees GROUP BY edition ORDER BY edition DESC`,
  ).all()

  return json({
    edition: EDITION_YEAR,
    orders: orders.results,
    stats: stats.results,
    seats: seats.results,
    polos: polos.results,
    attendees: attendees.results,
  })
}
