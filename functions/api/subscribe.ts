import { err, json } from '../../server/http'
import { addToNewsletter } from '../../server/mailjet'
import { verifyTurnstile } from '../../server/turnstile'
import type { Env } from '../../server/types'

type Body = { email?: string; turnstileToken?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const email = body.email?.trim() ?? ''
  if (!EMAIL_RE.test(email)) return err('Vul een geldig e-mailadres in.')

  const human = await verifyTurnstile(
    env,
    body.turnstileToken ?? '',
    request.headers.get('cf-connecting-ip') ?? undefined,
  )
  if (!human) return err('De spamcheck vertrouwt je niet. Probeer het opnieuw.', 403)

  try {
    await addToNewsletter(env, email)
  } catch (e) {
    console.error('nieuwsbrief inschrijving', e)
    return err('Inschrijven lukte even niet. Probeer het later nog eens.', 502)
  }
  return json({ ok: true })
}
