import { editionsForEmail, emailFromRequest } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email) return err('Niet ingelogd.', 401)
  return json({ email, editions: await editionsForEmail(env, email) })
}
