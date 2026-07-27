import { buildRoom } from '../../shared/seatmap'
import { editionsForEmail, emailFromRequest } from '../../server/auth'
import { err, json } from '../../server/http'
import type { Env } from '../../server/types'

type UserRow = {
  first_name: string | null
  last_name: string | null
  nickname: string | null
  role: string | null
}

/** Profiel van de ingelogde bezoeker; onbekende velden vullen we met wat we al weten. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email) return err('Niet ingelogd.', 401)

  const user = await env.DB.prepare(
    `SELECT first_name, last_name, nickname, role FROM users WHERE email = ?`,
  )
    .bind(email)
    .first<UserRow>()

  let firstName = user?.first_name ?? ''
  let lastName = user?.last_name ?? ''
  let nickname = user?.nickname ?? ''

  // Nog geen (volledig) profiel? Kijk in bestellingen, de import en de plattegrond.
  if (!firstName && !lastName) {
    const order = await env.DB.prepare(
      `SELECT first_name, last_name FROM orders
        WHERE lower(email) = ? AND first_name IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(email)
      .first<{ first_name: string; last_name: string }>()
    if (order) {
      firstName = order.first_name
      lastName = order.last_name
    } else {
      const attendee = await env.DB.prepare(
        `SELECT name FROM attendees WHERE email = ? AND name IS NOT NULL LIMIT 1`,
      )
        .bind(email)
        .first<{ name: string }>()
      if (attendee?.name) {
        const [first, ...rest] = attendee.name.split(' ')
        firstName = first
        lastName = rest.join(' ')
      }
    }
  }
  if (!nickname) {
    const seat = await env.DB.prepare(
      `SELECT s.nickname FROM seats s
         JOIN orders o ON o.id = s.order_id
        WHERE lower(o.email) = ?
        ORDER BY s.claimed_at DESC LIMIT 1`,
    )
      .bind(email)
      .first<{ nickname: string }>()
    if (seat?.nickname) nickname = seat.nickname
  }

  // Geclaimde plekken, alle edities (geschiedenis: waar zat je per jaar)
  const seatRows = await env.DB.prepare(
    `SELECT s.edition, s.seat_id AS seatId, s.nickname FROM seats s
       JOIN orders o ON o.id = s.order_id
      WHERE lower(o.email) = ?
      ORDER BY s.edition DESC, s.claimed_at`,
  )
    .bind(email)
    .all<{ edition: number; seatId: string; nickname: string }>()
  const seatNoById = new Map(
    buildRoom()
      .flat()
      .filter((c) => c.seatId)
      .map((c) => [c.seatId!, c.seatNo!]),
  )
  const seats = seatRows.results
    .map((s) => ({ ...s, seatNo: seatNoById.get(s.seatId) }))
    .filter(
      (s): s is { edition: number; seatId: string; nickname: string; seatNo: number } =>
        s.seatNo !== undefined,
    )

  return json({
    email,
    firstName,
    lastName,
    nickname,
    role: user?.role === 'admin' ? 'admin' : 'user',
    editions: await editionsForEmail(env, email),
    seats,
  })
}

type PutBody = { firstName?: string; lastName?: string; nickname?: string }

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email) return err('Niet ingelogd.', 401)

  let body: PutBody
  try {
    body = (await request.json()) as PutBody
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const firstName = body.firstName?.trim() ?? ''
  const lastName = body.lastName?.trim() ?? ''
  const nickname = body.nickname?.trim() ?? ''
  if (firstName.length > 40 || lastName.length > 40) return err('Naam is te lang.')
  if (nickname.length > 20) return err('Nickname mag maximaal 20 tekens zijn.')

  await env.DB.prepare(
    `INSERT INTO users (email, first_name, last_name, nickname, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       nickname = excluded.nickname,
       updated_at = excluded.updated_at`,
  )
    .bind(email, firstName || null, lastName || null, nickname || null, Date.now())
    .run()

  return json({ ok: true })
}
