import type { Env } from './types'

// Zonder TURNSTILE_SECRET_KEY draaien we op Cloudflare's altijd-goed testsecret,
// zodat lokaal ontwikkelen zonder configuratie werkt.
const TEST_SECRET = '1x0000000000000000000000000000000AA'

export async function verifyTurnstile(env: Env, token: string, ip?: string): Promise<boolean> {
  if (!token) return false
  const params = new URLSearchParams({
    // "||" en niet "??": een lege string in .dev.vars telt ook als niet-geconfigureerd
    secret: env.TURNSTILE_SECRET_KEY || TEST_SECRET,
    response: token,
  })
  if (ip) params.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: params,
  })
  const data = (await res.json()) as { success?: boolean }
  return data.success === true
}
