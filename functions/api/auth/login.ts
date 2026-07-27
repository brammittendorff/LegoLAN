import { createToken, editionsForEmail, LOGIN_TTL_MS } from '../../../server/auth'
import { renderEmail } from '../../../server/emailTemplate'
import { err, json } from '../../../server/http'
import { sendMail } from '../../../server/mailjet'
import { verifyTurnstile } from '../../../server/turnstile'
import type { Env } from '../../../server/types'

type Body = { email?: string; turnstileToken?: string; next?: string }

/** Alleen interne paden als redirect-doel, anders wordt de maillink een open redirect. */
const safeNext = (next: string | undefined): string =>
  next && /^\/[a-zA-Z0-9/_-]*$/.test(next) ? next : '/account'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  if (!EMAIL_RE.test(email)) return err('Vul een geldig e-mailadres in.')

  const human = await verifyTurnstile(
    env,
    body.turnstileToken ?? '',
    request.headers.get('cf-connecting-ip') ?? undefined,
  )
  if (!human) return err('De spamcheck vertrouwt je niet. Probeer het opnieuw.', 403)

  // Kennen we dit adres (editie, bestelling of eerder geregistreerd)?
  // Zo niet, dan mag de bezoeker zich registreren.
  const editions = await editionsForEmail(env, email)
  const registered = await env.DB.prepare(`SELECT 1 AS x FROM users WHERE email = ?`)
    .bind(email)
    .first<{ x: number }>()
  if (editions.length === 0 && !registered) {
    return json({ status: 'unknown' })
  }

  try {
    await sendLoginLink(env, email, new URL(request.url).origin, safeNext(body.next))
  } catch (e) {
    console.error('inloglink mailen mislukt', e)
    return err('Mail versturen lukte even niet. Probeer het later opnieuw.', 502)
  }
  return json({ status: 'sent' })
}

export async function sendLoginLink(
  env: Env,
  email: string,
  origin: string,
  next: string,
): Promise<void> {
  const token = await createToken(env, email, 'login', LOGIN_TTL_MS)
  const link = `${origin}/api/auth/callback?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`
  await sendMail(env, {
    toEmail: email,
    subject: 'Je inloglink voor LEGOLAN',
    text: [
      'Klik op deze link om in te loggen (15 minuten geldig):',
      link,
      '',
      'Niet aangevraagd? Negeer deze mail dan gewoon.',
      '(English: use the link above to sign in to legolan.nl.)',
    ].join('\n'),
    html: renderEmail({
      heading: 'Kom binnen',
      bodyHtml: `
        <p style="margin:0">Klik op de knop om in te loggen op legolan.nl. De link is 15 minuten geldig.</p>
        <p style="margin:16px 0 0 0;font-size:12px;opacity:0.75">Niet aangevraagd? Negeer deze mail dan gewoon. (English: use the button to sign in to legolan.nl.)</p>`,
      cta: { label: 'Inloggen', url: link },
      afterCtaHtml: `Of plak deze link in je browser: ${link}`,
    }),
  })
}
