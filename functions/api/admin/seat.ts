import { EDITION_YEAR } from '../../../shared/products'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

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
