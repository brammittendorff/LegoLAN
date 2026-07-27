import { bookedDaysFor, EDITION_YEAR, getProduct } from '../shared/products'
import { escapeHtml, renderEmail } from './emailTemplate'
import { sendMail } from './mailjet'
import type { Env, OrderItemRow, OrderRow } from './types'

/** Na een uur onbetaald geven we de gereserveerde voorraad weer vrij. */
export const PENDING_TTL_MS = 60 * 60 * 1000

export async function expireStalePending(env: Env): Promise<void> {
  await env.DB.prepare(
    `UPDATE orders SET status = 'expired' WHERE status = 'pending' AND created_at < ?`,
  )
    .bind(Date.now() - PENDING_TTL_MS)
    .run()
}

/** Verkocht/gereserveerd per product (betaald + lopende pending-orders). */
export async function soldCounts(env: Env): Promise<Record<string, number>> {
  const rs = await env.DB.prepare(
    `SELECT oi.product_id AS id, SUM(oi.qty) AS n
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('paid', 'pending')
      GROUP BY oi.product_id`,
  ).all<{ id: string; n: number }>()
  const counts: Record<string, number> = {}
  for (const row of rs.results) counts[row.id] = row.n
  return counts
}

/**
 * Bezette huur-PC's per eventdag (betaald + pending), voor producten met een
 * dagpool. Sleutel: "<pool>:<dag>".
 */
export async function bookedPerPoolDay(env: Env): Promise<Record<string, number>> {
  const rs = await env.DB.prepare(
    `SELECT oi.product_id AS id, oi.size AS size, SUM(oi.qty) AS n
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('paid', 'pending')
      GROUP BY oi.product_id, oi.size`,
  ).all<{ id: string; size: string | null; n: number }>()

  const booked: Record<string, number> = {}
  for (const row of rs.results) {
    const product = getProduct(row.id)
    if (!product?.pool) continue
    const days = bookedDaysFor(product, row.size)
    if (!days) continue
    for (const day of days) {
      const key = `${product.pool}:${day}`
      booked[key] = (booked[key] ?? 0) + row.n
    }
  }
  return booked
}

export function getOrder(env: Env, orderId: string): Promise<OrderRow | null> {
  return env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>()
}

export async function getOrderItems(env: Env, orderId: string): Promise<OrderItemRow[]> {
  const rs = await env.DB.prepare(`SELECT * FROM order_items WHERE order_id = ?`)
    .bind(orderId)
    .all<OrderItemRow>()
  return rs.results
}

/** Hoeveel plekken van elk soort deze order in totaal mag claimen. */
export function seatQuota(items: OrderItemRow[]): { seat: number; dayseat: number } {
  const quota = { seat: 0, dayseat: 0 }
  for (const item of items) {
    const product = getProduct(item.product_id)
    if (product?.type === 'ticket' && product.seatKind) {
      quota[product.seatKind] += (product.seatsPerUnit ?? 1) * item.qty
    }
  }
  return quota
}

/**
 * Markeer een order als betaald en stuur (eenmalig) de bevestigingsmail.
 * Idempotent: de webhook mag vaker langskomen.
 */
export async function markOrderPaid(env: Env, orderId: string, origin: string): Promise<void> {
  const order = await getOrder(env, orderId)
  if (!order) return

  if (order.status !== 'paid') {
    await env.DB.prepare(`UPDATE orders SET status = 'paid' WHERE id = ?`).bind(orderId).run()
  }

  const items = await getOrderItems(env, orderId)
  const quota = seatQuota(items)

  // Geschiedenis: een betaald ticket maakt je blijvend deelnemer van deze
  // editie (ook als de catalogus volgend jaar verandert).
  if (quota.seat + quota.dayseat > 0) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO attendees (email, edition, source, name) VALUES (?, ?, 'order', ?)`,
    )
      .bind(order.email.toLowerCase(), EDITION_YEAR, order.name)
      .run()
  }

  if (order.confirmation_sent) return
  const seatUrl = `${origin}/zaal?order=${orderId}`

  const itemLines = items.map((i) => {
    const product = getProduct(i.product_id)
    const name = product?.name.nl ?? i.product_id
    const size = i.size ? ` (${i.size})` : ''
    const print = i.custom_name ? ` - opdruk: "${i.custom_name}"` : ''
    return `${i.qty}× ${name}${size}${print}`
  })
  const total = (order.amount_cents / 100).toFixed(2).replace('.', ',')

  const hasSeats = quota.seat + quota.dayseat > 0
  const html = renderEmail({
    heading: `Welkom bij de club, ${escapeHtml(order.name)}`,
    bodyHtml: `
      <p style="margin:0 0 12px 0">Je betaling is binnen. Dit heb je besteld:</p>
      <ul style="margin:0 0 16px 0;padding-left:20px">
        ${itemLines.map((l) => `<li style="margin:4px 0">${escapeHtml(l)}</li>`).join('')}
      </ul>
      <p style="margin:0;color:#fff6fb"><strong>Totaal: &euro; ${total}</strong></p>
      ${hasSeats ? '<p style="margin:16px 0 0 0">Nu het belangrijkste: waar zit je?</p>' : ''}
      <p style="margin:16px 0 0 0">Vragen? Beantwoord gewoon deze mail.</p>`,
    cta: hasSeats ? { label: 'Kies je plek in de zaal', url: seatUrl } : undefined,
    afterCtaHtml: hasSeats ? `Of plak deze link in je browser: ${seatUrl}` : undefined,
  })

  const text = [
    `Welkom bij de club, ${order.name}!`,
    '',
    'Je betaling is binnen. Dit heb je besteld:',
    ...itemLines.map((l) => `- ${l}`),
    '',
    `Totaal: € ${total}`,
    ...(quota.seat + quota.dayseat > 0 ? ['', `Kies je plek in de zaal: ${seatUrl}`] : []),
  ].join('\n')

  try {
    await sendMail(env, {
      toEmail: order.email,
      toName: order.name,
      subject: `Je bent binnen - LEGOLAN bestelling bevestigd`,
      html,
      text,
      replyTo: env.CONTACT_EMAIL ? { email: env.CONTACT_EMAIL } : undefined,
    })
    await env.DB.prepare(`UPDATE orders SET confirmation_sent = 1 WHERE id = ?`)
      .bind(orderId)
      .run()
  } catch (e) {
    // Mail mislukt ≠ betaling mislukt; volgende webhook-poging probeert opnieuw.
    console.error('bevestigingsmail mislukt', e)
  }
}

/** Terugbetaalde order: status om, plekken op de plattegrond weer vrij. */
export async function markOrderRefunded(env: Env, orderId: string): Promise<void> {
  const order = await getOrder(env, orderId)
  await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET status = 'refunded' WHERE id = ? AND status = 'paid'`).bind(orderId),
    env.DB.prepare(`DELETE FROM seats WHERE order_id = ?`).bind(orderId),
  ])

  // Deelname aan deze editie intrekken, tenzij een andere betaalde
  // ticket-order van hetzelfde adres nog geldig is.
  if (order) {
    const email = order.email.toLowerCase()
    const other = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
       WHERE o.status = 'paid' AND lower(o.email) = ? AND o.edition = ? AND o.id != ?
         AND oi.product_id LIKE 'ticket-%'`,
    )
      .bind(email, EDITION_YEAR, orderId)
      .first<{ n: number }>()
    if ((other?.n ?? 0) === 0) {
      await env.DB.prepare(
        `DELETE FROM attendees WHERE email = ? AND edition = ? AND source = 'order'`,
      )
        .bind(email, EDITION_YEAR)
        .run()
    }
  }
}
