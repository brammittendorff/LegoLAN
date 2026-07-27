import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

/** Gebruikersbeheer voor Backstage: lijst + rol wijzigen. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const rs = await env.DB.prepare(
    `SELECT u.email, u.first_name AS firstName, u.last_name AS lastName,
            u.nickname, u.role,
            (SELECT group_concat(a.edition, ' ') FROM attendees a WHERE a.email = u.email) AS editions
       FROM users u
      ORDER BY u.role DESC, u.email`,
  ).all()
  return json({ users: rs.results })
}

type Body = { email?: string; role?: string }

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const adminEmail = await emailFromRequest(env, request)
  if (!adminEmail || !(await isAdmin(env, adminEmail))) return err('Geen toegang.', 403)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const target = body.email?.trim().toLowerCase() ?? ''
  const role = body.role
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return err('Ongeldig e-mailadres.')
  if (role !== 'admin' && role !== 'user') return err('Rol moet admin of user zijn.')

  // Jezelf degraderen kan een club zonder admins opleveren; niet doen.
  if (target === adminEmail && role !== 'admin') {
    return err('Je kunt je eigen admin-rol niet afpakken. Vraag een andere admin.', 409)
  }

  await env.DB.prepare(
    `INSERT INTO users (email, role, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at`,
  )
    .bind(target, role, Date.now())
    .run()
  return json({ ok: true })
}
