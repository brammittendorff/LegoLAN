import { EDITION_YEAR } from '../../../shared/products'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

type Body = { finished?: boolean }

/** De uit-knop: zet de huidige editie op voorbij (of weer open). */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }
  if (typeof body.finished !== 'boolean') return err('Ongeldige aanvraag.')

  await env.DB.prepare(
    `INSERT INTO edition_status (edition, finished, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (edition) DO UPDATE SET
       finished = excluded.finished, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(EDITION_YEAR, body.finished ? 1 : 0, Date.now(), email)
    .run()
  return json({ ok: true, finished: body.finished })
}
