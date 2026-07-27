import { err, json } from '../../../server/http'
import { verifyTurnstile } from '../../../server/turnstile'
import type { Env } from '../../../server/types'
import { sendLoginLink } from './login'

type Body = {
  email?: string
  firstName?: string
  lastName?: string
  nickname?: string
  turnstileToken?: string
  next?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const safeNext = (next: string | undefined): string =>
  next && /^\/[a-zA-Z0-9/_?=&-]*$/.test(next) ? next : '/account'

/** Nieuw account: profiel opslaan en meteen de inloglink mailen. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  const firstName = body.firstName?.trim() ?? ''
  const lastName = body.lastName?.trim() ?? ''
  const nickname = body.nickname?.trim() ?? ''
  if (!EMAIL_RE.test(email)) return err('Vul een geldig e-mailadres in.')
  if (firstName.length < 2 || firstName.length > 40) return err('Vul je voornaam in.')
  if (lastName.length < 2 || lastName.length > 40) return err('Vul je achternaam in.')
  if (nickname.length < 2 || nickname.length > 20) return err('Kies een nickname van 2 tot 20 tekens.')

  const human = await verifyTurnstile(
    env,
    body.turnstileToken ?? '',
    request.headers.get('cf-connecting-ip') ?? undefined,
  )
  if (!human) return err('De spamcheck vertrouwt je niet. Probeer het opnieuw.', 403)

  // Bestaat het account al? Dan alleen de inloglink sturen en het profiel
  // met rust laten (anders kan een vreemde andermans naam overschrijven).
  await env.DB.prepare(
    `INSERT INTO users (email, first_name, last_name, nickname, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO NOTHING`,
  )
    .bind(email, firstName, lastName, nickname, Date.now())
    .run()

  try {
    await sendLoginLink(env, email, new URL(request.url).origin, safeNext(body.next))
  } catch (e) {
    console.error('inloglink mailen mislukt', e)
    return err('Mail versturen lukte even niet. Probeer het later opnieuw.', 502)
  }
  return json({ status: 'sent' })
}
