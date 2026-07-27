import { emailFromRequest, invalidateAllSessions, sessionClearCookie } from '../../../server/auth'
import type { Env } from '../../../server/types'

type Body = { everywhere?: boolean }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    /* leeg body = gewoon uitloggen */
  }

  // "Overal uitloggen": maakt ook alle uitstaande loginlinks en sessies
  // op andere apparaten ongeldig.
  if (body.everywhere) {
    const email = await emailFromRequest(env, request)
    if (email) await invalidateAllSessions(env, email)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': sessionClearCookie(),
    },
  })
}
