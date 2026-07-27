import { EDITION_YEAR, PRODUCTS } from '../shared/products'
import type { Env } from './types'

/*
 * Wachtwoordloos inloggen: een HMAC-getekende token in een maillink (15 min
 * geldig) wordt ingewisseld voor een sessiecookie (30 dagen). Er staat dus
 * nergens een wachtwoord in de database.
 */

const COOKIE = 'legolan_sessie'
export const LOGIN_TTL_MS = 15 * 60 * 1000
export const SESSION_TTL_S = 30 * 24 * 3600

const enc = new TextEncoder()

type TokenKind = 'login' | 'sessie'
type Payload = { e: string; k: TokenKind; x: number }

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromB64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

async function signPart(env: Env, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(env.AUTH_SECRET || 'dev-secret-verander-mij'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return b64url(new Uint8Array(sig))
}

export async function createToken(env: Env, email: string, kind: TokenKind, ttlMs: number): Promise<string> {
  const payload: Payload = { e: email, k: kind, x: Date.now() + ttlMs }
  const body = b64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${await signPart(env, body)}`
}

export async function verifyToken(env: Env, token: string, kind: TokenKind): Promise<string | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  if ((await signPart(env, body)) !== sig) return null
  const bytes = fromB64url(body)
  if (!bytes) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Payload
    if (payload.k !== kind || typeof payload.e !== 'string') return null
    if (typeof payload.x !== 'number' || payload.x < Date.now()) return null
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

/** Alle edities waar dit adres bij was: import uit WordPress + betaalde orders van nu. */
export async function editionsForEmail(env: Env, email: string): Promise<number[]> {
  const editions = new Set<number>()

  const imported = await env.DB.prepare(`SELECT edition FROM attendees WHERE email = ?`)
    .bind(email)
    .all<{ edition: number }>()
  for (const row of imported.results) editions.add(row.edition)

  const ticketIds = PRODUCTS.filter((p) => p.type === 'ticket').map((p) => p.id)
  if (ticketIds.length > 0) {
    const placeholders = ticketIds.map(() => '?').join(',')
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status = 'paid' AND lower(o.email) = ? AND oi.product_id IN (${placeholders})`,
    )
      .bind(email, ...ticketIds)
      .first<{ n: number }>()
    if ((row?.n ?? 0) > 0) editions.add(EDITION_YEAR)
  }

  return [...editions].sort((a, b) => b - a)
}
