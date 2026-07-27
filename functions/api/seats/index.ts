import { EDITION_YEAR } from '../../../shared/products'
import { emailFromRequest } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // De plattegrond (met nicknames) is alleen voor ingelogde bezoekers.
  if (!(await emailFromRequest(env, request))) return err('Niet ingelogd.', 401)
  const rs = await env.DB.prepare(
    `SELECT seat_id AS seatId, nickname FROM seats WHERE edition = ? ORDER BY claimed_at`,
  )
    .bind(EDITION_YEAR)
    .all<{ seatId: string; nickname: string }>()
  return json({ seats: rs.results })
}
