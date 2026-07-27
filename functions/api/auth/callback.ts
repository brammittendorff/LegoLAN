import { createToken, sessionSetCookie, verifyToken, SESSION_TTL_S } from '../../../server/auth'
import type { Env } from '../../../server/types'

/** De link uit de mail: wisselt de logintoken in voor een sessiecookie. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? ''
  const rawNext = url.searchParams.get('next') ?? ''
  const next = /^\/[a-zA-Z0-9/_?=&-]*$/.test(rawNext) ? rawNext : '/account'
  const email = await verifyToken(env, token, 'login')

  if (!email) {
    const sep = next.includes('?') ? '&' : '?'
    return Response.redirect(`${url.origin}${next}${sep}fout=link`, 302)
  }

  // Iedereen die ooit inlogt krijgt een account-rij (zichtbaar in Backstage).
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (email, role, updated_at) VALUES (?, 'user', ?)`,
  )
    .bind(email, Date.now())
    .run()

  const session = await createToken(env, email, 'sessie', SESSION_TTL_S * 1000)
  return new Response(null, {
    status: 302,
    headers: {
      location: `${url.origin}${next}`,
      'set-cookie': sessionSetCookie(session),
    },
  })
}
