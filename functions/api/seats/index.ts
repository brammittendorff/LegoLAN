import { EDITION_YEAR } from '../../../shared/products'
import { json } from '../../../server/http'
import type { Env } from '../../../server/types'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rs = await env.DB.prepare(
    `SELECT seat_id AS seatId, nickname FROM seats WHERE edition = ? ORDER BY claimed_at`,
  )
    .bind(EDITION_YEAR)
    .all<{ seatId: string; nickname: string }>()
  return json({ seats: rs.results })
}
