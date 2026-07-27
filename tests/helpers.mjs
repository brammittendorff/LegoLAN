import { execSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import http from 'node:http'
import { encrypt } from 'paseto-ts/v4'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Zelfde HMAC als de server; de testserver draait met dit secret als binding. */
export const AUTH_SECRET = 'ci-test-secret'

function pasetoKey() {
  const digest = crypto.createHash('sha256').update(AUTH_SECRET).digest()
  return Buffer.concat([Buffer.from('k4.local.'), digest])
}

export function makeToken(email, kind = 'sessie', ttlMs = 3600_000) {
  return encrypt(new Uint8Array(pasetoKey()), {
    e: email,
    k: kind,
    exp: new Date(Date.now() + ttlMs).toISOString(),
  })
}

export const sessionCookie = async (email) => `legolan_sessie=${await makeToken(email)}`

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
  // Lokale mail-sink: vangt alles op wat de server via MAILPIT_URL "verstuurt".
  // Zonder deze binding laadt wrangler .dev.vars en gaat testmail echt via Mailjet
  // de deur uit (en vreet die de daglimiet van het account op).
  const mailSink = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ID":"test-sink"}')
    })
  })
  await new Promise((resolve) => mailSink.listen(0, '127.0.0.1', resolve))
  const proc = spawn(
    'npx',
    [
      'wrangler', 'pages', 'dev',
      '--port', String(port),
      '--persist-to', persist,
      '--binding', `MOLLIE_API_KEY=${mollieKey}`,
      '--binding', `AUTH_SECRET=${AUTH_SECRET}`,
      '--binding', 'CRON_SECRET=ci-cron-secret',
      '--binding', `MAILPIT_URL=http://127.0.0.1:${mailSink.address().port}`,
      '--binding', 'MAILJET_API_KEY=',
      '--binding', 'MAILJET_API_SECRET=',
    ],
    { stdio: process.env.TEST_DEBUG ? 'inherit' : 'ignore', detached: true },
  )
  proc.mailSink = mailSink

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
  proc.mailSink?.close()
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
