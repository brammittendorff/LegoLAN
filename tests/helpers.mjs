import { execSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Zelfde HMAC als de server; de testserver draait met dit secret als binding. */
export const AUTH_SECRET = 'ci-test-secret'

const b64url = (input) =>
  Buffer.from(input).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

export function makeToken(email, kind = 'sessie', ttlMs = 3600_000) {
  const body = b64url(JSON.stringify({ e: email, k: kind, x: Date.now() + ttlMs }))
  const sig = b64url(crypto.createHmac('sha256', AUTH_SECRET).update(body).digest())
  return `${body}.${sig}`
}

export const sessionCookie = (email) => `legolan_sessie=${makeToken(email)}`

/**
 * Start een verse wrangler-instantie met eigen (lege) lokale D1.
 * mollieKey: 'fake' voor directe betalingen, of een echte test_-key.
 */
export async function startServer({ port, mollieKey }) {
  const persist = mkdtempSync(path.join(os.tmpdir(), 'legolan-test-'))
  execSync(`npx wrangler d1 migrations apply legolan --local --persist-to "${persist}"`, {
    stdio: 'ignore',
    env: { ...process.env, CI: 'true' },
  })
  const proc = spawn(
    'npx',
    [
      'wrangler', 'pages', 'dev',
      '--port', String(port),
      '--persist-to', persist,
      '--binding', `MOLLIE_API_KEY=${mollieKey}`,
      '--binding', `AUTH_SECRET=${AUTH_SECRET}`,
      '--binding', 'CRON_SECRET=ci-cron-secret',
    ],
    { stdio: process.env.TEST_DEBUG ? 'inherit' : 'ignore', detached: true },
  )

  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/stock`)
      if (res.ok) return { proc, persist, base: `http://localhost:${port}` }
    } catch {
      /* nog niet klaar */
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  stopServer(proc)
  throw new Error(`testserver op poort ${port} kwam niet op`)
}

export function stopServer(proc) {
  try {
    process.kill(-proc.pid, 'SIGTERM')
  } catch {
    try {
      proc.kill('SIGTERM')
    } catch {
      /* al weg */
    }
  }
}

/** Losse SQL tegen de test-database (bv. iemand admin maken). */
export function d1(persist, sql) {
  execSync(
    `npx wrangler d1 execute legolan --local --persist-to "${persist}" --command ${JSON.stringify(sql)}`,
    { stdio: 'ignore', env: { ...process.env, CI: 'true' } },
  )
}

// ---- mini-testharnas ----
let failures = 0
let count = 0

export async function test(name, fn) {
  count++
  try {
    await fn()
    console.log(`  ok ${count} - ${name}`)
  } catch (e) {
    failures++
    console.error(`  NIET ok ${count} - ${name}`)
    console.error(`    ${e.message}`)
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

export function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: kreeg ${JSON.stringify(actual)}, verwachtte ${JSON.stringify(expected)}`)
  }
}

export function summary(label) {
  console.log(failures === 0 ? `${label}: alle ${count} tests groen` : `${label}: ${failures}/${count} tests ROOD`)
  return failures
}

export async function jsonReq(base, pathname, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* geen json */
  }
  return { status: res.status, data }
}
