import { decrypt, encrypt } from 'paseto-ts/v4'
import { EDITION_YEAR, PRODUCTS } from '../shared/products'
import type { Env } from './types'

/*
 * Wachtwoordloos inloggen: een PASETO v4.local-token (XChaCha20-Poly1305,
 * versleuteld én geauthenticeerd) in een maillink (15 min geldig) wordt
 * ingewisseld voor een sessiecookie (30 dagen). Er staat dus nergens een
 * wachtwoord in de database en de payload is onleesbaar zonder de sleutel.
 */

const COOKIE = 'legolan_sessie'
export const LOGIN_TTL_MS = 15 * 60 * 1000
export const SESSION_TTL_S = 30 * 24 * 3600

const enc = new TextEncoder()

type TokenKind = 'login' | 'sessie'
type Payload = { e: string; k: TokenKind; exp: string }

/** Constante-tijd-vergelijking tegen timing-aanvallen op gedeelde geheimen. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * PASERK-sleutel (41 bytes: "k4.local." + 32 sleutelbytes), deterministisch
 * afgeleid van AUTH_SECRET zodat bestaande secrets bruikbaar blijven.
 */
async function pasetoKey(env: Env): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(env.AUTH_SECRET || 'dev-secret-verander-mij'),
  )
  const key = new Uint8Array(41)
  key.set(enc.encode('k4.local.'), 0)
  key.set(new Uint8Array(digest), 9)
  return key
}

export async function createToken(env: Env, email: string, kind: TokenKind, ttlMs: number): Promise<string> {
  return encrypt(await pasetoKey(env), {
    e: email,
    k: kind,
    exp: new Date(Date.now() + ttlMs).toISOString(),
  })
}

export async function verifyToken(env: Env, token: string, kind: TokenKind): Promise<string | null> {
  try {
    // decrypt controleert de authenticatie-tag en de exp-claim zelf.
    const { payload } = await decrypt<Payload>(await pasetoKey(env), token)
    if (payload.k !== kind || typeof payload.e !== 'string') return null
    return payload.e
  } catch {
    return null
  }
}

export function sessionSetCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_S}`
}

export function sessionClearCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`
}

export async function emailFromRequest(env: Env, request: Request): Promise<string | null> {
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (!match) return null
  return verifyToken(env, decodeURIComponent(match[1]), 'sessie')
}

/** Is dit adres een beheerder? (users.role = 'admin') */
export async function isAdmin(env: Env, email: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT role FROM users WHERE email = ?`)
    .bind(email)
    .first<{ role: string }>()
  return row?.role === 'admin'
}

/** Het adres zelf plus alle gekoppelde oude adressen (email_aliases). */
export async function emailsFor(env: Env, email: string): Promise<string[]> {
  const rows = await env.DB.prepare(`SELECT alias FROM email_aliases WHERE user_email = ?`)
    .bind(email)
    .all<{ alias: string }>()
  return [email, ...rows.results.map((r) => r.alias)]
}

/** Alle edities waar dit adres (incl. gekoppelde oude adressen) bij was. */
export async function editionsForEmail(env: Env, email: string): Promise<number[]> {
  const editions = new Set<number>()
  const emails = await emailsFor(env, email)
  const emailPh = emails.map(() => '?').join(',')

  const imported = await env.DB.prepare(
    `SELECT edition FROM attendees WHERE email IN (${emailPh})`,
  )
    .bind(...emails)
    .all<{ edition: number }>()
  for (const row of imported.results) editions.add(row.edition)

  const ticketIds = PRODUCTS.filter((p) => p.type === 'ticket').map((p) => p.id)
  if (ticketIds.length > 0) {
    const ticketPh = ticketIds.map(() => '?').join(',')
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status = 'paid' AND lower(o.email) IN (${emailPh}) AND oi.product_id IN (${ticketPh})`,
    )
      .bind(...emails, ...ticketIds)
      .first<{ n: number }>()
    if ((row?.n ?? 0) > 0) editions.add(EDITION_YEAR)
  }

  return [...editions].sort((a, b) => b - a)
}
