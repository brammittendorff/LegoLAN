import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

/** Gebruikersbeheer voor Backstage: lijst + profiel/rol/edities wijzigen. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const rs = await env.DB.prepare(
    `SELECT u.email, u.first_name AS firstName, u.last_name AS lastName,
            u.nickname, u.role,
            (SELECT group_concat(a.edition, ' ') FROM attendees a
              WHERE a.email = u.email
                 OR a.email IN (SELECT alias FROM email_aliases WHERE user_email = u.email)) AS editions,
            (SELECT group_concat(al.alias, ' ') FROM email_aliases al WHERE al.user_email = u.email) AS aliases
       FROM users u
      ORDER BY u.role DESC, u.email`,
  ).all()
  return json({ users: rs.results })
}

/** Account verwijderen (bv. testaccounts). Bestellingen/deelnames blijven staan. */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const adminEmail = await emailFromRequest(env, request)
  if (!adminEmail || !(await isAdmin(env, adminEmail))) return err('Geen toegang.', 403)

  const target = new URL(request.url).searchParams.get('email')?.trim().toLowerCase() ?? ''
  if (!target) return err('Geen e-mailadres.')
  if (target === adminEmail) return err('Jezelf verwijderen kan niet.', 409)

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM users WHERE email = ?`).bind(target),
    env.DB.prepare(`DELETE FROM email_aliases WHERE user_email = ?`).bind(target),
  ])
  return json({ ok: true })
}

type Body = {
  email?: string
  role?: string
  firstName?: string
  lastName?: string
  nickname?: string
  editions?: number[]
  aliases?: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  if (!EMAIL_RE.test(target)) return err('Ongeldig e-mailadres.')

  // Bestaand profiel ophalen zodat niet-meegestuurde velden blijven staan.
  const existing = await env.DB.prepare(
    `SELECT first_name, last_name, nickname, role FROM users WHERE email = ?`,
  )
    .bind(target)
    .first<{ first_name: string | null; last_name: string | null; nickname: string | null; role: string }>()

  let role = existing?.role ?? 'user'
  if (body.role !== undefined) {
    if (body.role !== 'admin' && body.role !== 'user') return err('Rol moet admin of user zijn.')
    // Jezelf degraderen kan een club zonder admins opleveren; niet doen.
    if (target === adminEmail && body.role !== 'admin') {
      return err('Je kunt je eigen admin-rol niet afpakken. Vraag een andere admin.', 409)
    }
    role = body.role
  }

  const clean = (value: string | undefined, max: number): string | null | undefined => {
    if (value === undefined) return undefined
    const s = value.trim()
    if (s.length > max) return undefined
    return s || null
  }
  const firstName = clean(body.firstName, 40)
  const lastName = clean(body.lastName, 40)
  const nickname = clean(body.nickname, 20)

  await env.DB.prepare(
    `INSERT INTO users (email, first_name, last_name, nickname, role, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       nickname = excluded.nickname,
       role = excluded.role,
       updated_at = excluded.updated_at`,
  )
    .bind(
      target,
      firstName !== undefined ? firstName : (existing?.first_name ?? null),
      lastName !== undefined ? lastName : (existing?.last_name ?? null),
      nickname !== undefined ? nickname : (existing?.nickname ?? null),
      role,
      Date.now(),
    )
    .run()

  // Edities synchroniseren met de attendees-tabel (fototoegang/geschiedenis).
  if (Array.isArray(body.editions)) {
    const wanted = new Set(
      body.editions.filter((y) => Number.isInteger(y) && y >= 2019 && y <= 2100),
    )
    const current = await env.DB.prepare(`SELECT edition FROM attendees WHERE email = ?`)
      .bind(target)
      .all<{ edition: number }>()
    const have = new Set(current.results.map((r) => r.edition))

    const name = [firstName ?? existing?.first_name, lastName ?? existing?.last_name]
      .filter(Boolean)
      .join(' ')
    const statements = []
    for (const year of wanted) {
      if (!have.has(year)) {
        statements.push(
          env.DB.prepare(
            `INSERT OR IGNORE INTO attendees (email, edition, source, name) VALUES (?, ?, 'handmatig', ?)`,
          ).bind(target, year, name || null),
        )
      }
    }
    for (const year of have) {
      if (!wanted.has(year)) {
        statements.push(
          env.DB.prepare(`DELETE FROM attendees WHERE email = ? AND edition = ?`).bind(target, year),
        )
      }
    }
    if (statements.length > 0) await env.DB.batch(statements)
  }

  // Gekoppelde oude e-mailadressen synchroniseren.
  if (Array.isArray(body.aliases)) {
    const wanted = new Set(
      body.aliases
        .map((a) => String(a).trim().toLowerCase())
        .filter((a) => EMAIL_RE.test(a) && a !== target),
    )
    const current = await env.DB.prepare(`SELECT alias FROM email_aliases WHERE user_email = ?`)
      .bind(target)
      .all<{ alias: string }>()
    const have = new Set(current.results.map((r) => r.alias))

    const statements = []
    for (const alias of wanted) {
      if (!have.has(alias)) {
        statements.push(
          env.DB.prepare(
            `INSERT OR REPLACE INTO email_aliases (alias, user_email, created_at) VALUES (?, ?, ?)`,
          ).bind(alias, target, Date.now()),
        )
      }
    }
    for (const alias of have) {
      if (!wanted.has(alias)) {
        statements.push(
          env.DB.prepare(`DELETE FROM email_aliases WHERE alias = ? AND user_email = ?`).bind(alias, target),
        )
      }
    }
    if (statements.length > 0) await env.DB.batch(statements)
  }

  return json({ ok: true })
}
