import { sessionClearCookie } from '../../../server/auth'
import type { Env } from '../../../server/types'

export const onRequestPost: PagesFunction<Env> = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': sessionClearCookie(),
    },
  })
}
