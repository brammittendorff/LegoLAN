import { createToken, LOGIN_TTL_MS } from './auth'
import { renderEmail } from './emailTemplate'
import { sendMail } from './mailjet'
import type { Env } from './types'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Iemand een plek toesturen: de koper vult bij een plek het adres in van wie
 * daar zit, en die krijgt een inloglink naar de plattegrond. Daar kan hij zijn
 * eigen naam op de plek aanpassen.
 *
 * Mail mislukt is geen reden om de claim te laten mislukken: de plek staat dan
 * al goed, en de koper kan het adres opnieuw opslaan.
 */
export async function sendSeatInvite(
  env: Env,
  opts: { email: string; origin: string; seatNo: number; nickname: string; byName?: string },
): Promise<void> {
  const token = await createToken(env, opts.email, 'login', LOGIN_TTL_MS)
  const link = `${opts.origin}/api/auth/callback?token=${encodeURIComponent(token)}&next=${encodeURIComponent('/zaal')}`
  const van = opts.byName ? ` van ${opts.byName}` : ''

  await sendMail(env, {
    toEmail: opts.email,
    subject: `Plek ${opts.seatNo} in de zaal staat op jouw naam`,
    text: [
      `Er is een plek voor je gereserveerd${van}: plek ${opts.seatNo}, met "${opts.nickname}" op de plattegrond.`,
      '',
      'Klik op deze link om in te loggen (15 minuten geldig). Daarna kun je je eigen naam op de plek zetten:',
      link,
      '',
      'Klopt er iets niet? Mail ons gewoon terug.',
      '(English: a seat has been reserved for you; use the link above to sign in and set your own name.)',
    ].join('\n'),
    html: renderEmail({
      heading: `Plek ${opts.seatNo} is voor jou`,
      bodyHtml: `
        <p style="margin:0 0 12px 0">Er is een plek voor je gereserveerd${van}: <strong>plek ${opts.seatNo}</strong>, met "${opts.nickname}" op de plattegrond.</p>
        <p style="margin:0">Log in met de knop hieronder (15 minuten geldig) en zet je eigen naam op de plek.</p>
        <p style="margin:16px 0 0 0;font-size:12px;opacity:0.75">Klopt er iets niet? Mail ons gewoon terug. (English: a seat has been reserved for you; sign in to set your own name.)</p>`,
      cta: { label: 'Bekijk je plek', url: link },
      afterCtaHtml: `Of plak deze link in je browser: ${link}`,
    }),
  })
}
