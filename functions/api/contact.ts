import { escapeHtml, renderEmail } from '../../server/emailTemplate'
import { err, json } from '../../server/http'
import { sendMail } from '../../server/mailjet'
import { verifyTurnstile } from '../../server/turnstile'
import type { Env } from '../../server/types'

type Body = { name?: string; email?: string; message?: string; turnstileToken?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const name = body.name?.trim() ?? ''
  const email = body.email?.trim() ?? ''
  const message = body.message?.trim() ?? ''
  if (name.length < 2 || name.length > 80) return err('Vul je naam in.')
  if (!EMAIL_RE.test(email)) return err('Vul een geldig e-mailadres in.')
  if (message.length < 10 || message.length > 5000) return err('Schrijf een iets langer bericht.')

  const human = await verifyTurnstile(
    env,
    body.turnstileToken ?? '',
    request.headers.get('cf-connecting-ip') ?? undefined,
  )
  if (!human) return err('De spamcheck vertrouwt je niet. Probeer het opnieuw.', 403)

  try {
    await sendMail(env, {
      toEmail: env.CONTACT_EMAIL || 'info@legolan.nl',
      subject: `Contactformulier: bericht van ${name}`,
      text: `Van: ${name} <${email}>\n\n${message}`,
      html: renderEmail({
        heading: `Bericht van ${escapeHtml(name)}`,
        bodyHtml: `
          <p style="margin:0 0 12px 0;font-size:12px;opacity:0.75">Via het contactformulier &middot; antwoorden gaat direct naar ${escapeHtml(email)}</p>
          <p style="margin:0">${escapeHtml(message).replaceAll('\n', '<br>')}</p>`,
      }),
      replyTo: { email, name },
    })
  } catch (e) {
    console.error('contactformulier', e)
    return err('Versturen lukte even niet. Probeer het later nog eens.', 502)
  }
  return json({ ok: true })
}
