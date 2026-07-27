import { EDITION_YEAR } from '../../../shared/products'
import { allSeatIds } from '../../../shared/seatmap'
import { emailFromRequest, emailsFor, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import { getOrderItems, seatQuota } from '../../../server/orders'
import type { Env } from '../../../server/types'

/**
 * Plek toewijzen aan een e-mailadres. Heeft die persoon een betaalde
 * bestelling met plek-tegoed, dan hangt de plek daaraan (telt mee in het
 * quotum en is zelf vrij te geven); anders staat hij op naam en beheert
 * de admin hem.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminEmail = await emailFromRequest(env, request)
  if (!adminEmail || !(await isAdmin(env, adminEmail))) return err('Geen toegang.', 403)

  let body: { seatId?: string; email?: string; nickname?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const seatId = body.seatId ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  let nickname = body.nickname?.trim() ?? ''
  if (!allSeatIds().has(seatId)) return err('Die plek bestaat niet.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Geen geldig e-mailadres.')
  if (nickname.length > 20) return err('Nickname mag maximaal 20 tekens zijn.')

  if (!nickname) {
    const user = await env.DB.prepare(`SELECT nickname FROM users WHERE email = ?`)
      .bind(email)
      .first<{ nickname: string | null }>()
    nickname = user?.nickname || email.split('@')[0].slice(0, 20)
  }

  // Betaalde bestelling met vrij plek-tegoed? Dan wordt dit een gewone claim.
  const emails = await emailsFor(env, email)
  const paid = await env.DB.prepare(
    `SELECT id FROM orders
      WHERE status = 'paid' AND edition = ? AND lower(email) IN (${emails.map(() => '?').join(',')})
      ORDER BY created_at`,
  )
    .bind(EDITION_YEAR, ...emails)
    .all<{ id: string }>()
  let orderId: string | null = null
  for (const row of paid.results) {
    const quota = seatQuota(await getOrderItems(env, row.id))
    const claimed = await env.DB.prepare(`SELECT COUNT(*) AS n FROM seats WHERE order_id = ?`)
      .bind(row.id)
      .first<{ n: number }>()
    if ((claimed?.n ?? 0) < quota) {
      orderId = row.id
      break
    }
  }

  try {
    await env.DB.prepare(
      `INSERT INTO seats (edition, seat_id, order_id, owner_email, nickname, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(EDITION_YEAR, seatId, orderId, orderId ? null : email, nickname, Date.now())
      .run()
  } catch (e) {
    if (String(e).includes('UNIQUE') || String(e).includes('PRIMARY KEY')) {
      return err('Die plek is al bezet.', 409)
    }
    throw e
  }

  return json({ ok: true, viaOrder: orderId !== null })
}

/** Plek vrijgeven (bv. iemand wil verhuizen): admin haalt de claim weg. */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const seatId = new URL(request.url).searchParams.get('seatId') ?? ''
  if (!seatId) return err('Geen seatId.')

  const result = await env.DB.prepare(`DELETE FROM seats WHERE edition = ? AND seat_id = ?`)
    .bind(EDITION_YEAR, seatId)
    .run()
  return json({ ok: true, released: result.meta.changes > 0 })
}
