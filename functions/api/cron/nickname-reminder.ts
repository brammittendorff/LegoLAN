import { safeEqual } from '../../../server/auth'
import { escapeHtml, renderEmail } from '../../../server/emailTemplate'
import { err, json } from '../../../server/http'
import { sendMail } from '../../../server/mailjet'
import type { Env } from '../../../server/types'

/** Herinner maximaal eens per 30 dagen; de cron zelf draait wekelijks. */
const REMIND_INTERVAL_MS = 30 * 24 * 3600 * 1000
const BATCH = 25

/**
 * Wordt wekelijks aangeroepen door GitHub Actions (reminders.yml) met de
 * gedeelde CRON_SECRET. Mailt gebruikers die hun nickname nog niet hebben
 * ingevuld een vriendelijk duwtje richting /account.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.CRON_SECRET || !safeEqual(request.headers.get('x-cron-key') ?? '', env.CRON_SECRET)) {
    return err('Geen toegang.', 403)
  }

  const cutoff = Date.now() - REMIND_INTERVAL_MS
  const rs = await env.DB.prepare(
    `SELECT email, first_name AS firstName FROM users
      WHERE (nickname IS NULL OR nickname = '')
        AND (nickname_reminded_at IS NULL OR nickname_reminded_at < ?)
      LIMIT ${BATCH}`,
  )
    .bind(cutoff)
    .all<{ email: string; firstName: string | null }>()

  const origin = new URL(request.url).origin
  let sent = 0
  for (const user of rs.results) {
    const aanhef = user.firstName ? `Hoi ${user.firstName}` : 'Hoi'
    try {
      await sendMail(env, {
        toEmail: user.email,
        subject: 'Hoe heet jij op de plattegrond?',
        text: [
          `${aanhef},`,
          '',
          'Je account op legolan.nl heeft nog geen nickname - en dat is toch de naam',
          'waarmee je op de plattegrond (en eventueel je polo) pronkt.',
          '',
          `Invullen duurt tien seconden: ${origin}/account`,
          '',
          'Geen zin? Ook prima, dan vragen we het over een tijdje nog een keertje.',
        ].join('\n'),
        html: renderEmail({
          heading: `${escapeHtml(aanhef)}, hoe heet jij eigenlijk?`,
          bodyHtml: `
            <p style="margin:0">Je account heeft nog geen nickname - en dat is toch de naam waarmee je op de plattegrond (en eventueel je polo) pronkt. Invullen duurt tien seconden.</p>
            <p style="margin:16px 0 0 0;font-size:12px;opacity:0.75">Geen zin? Ook prima, dan vragen we het over een tijdje nog een keertje.</p>`,
          cta: { label: 'Vul je nickname in', url: `${origin}/account` },
        }),
      })
      await env.DB.prepare(`UPDATE users SET nickname_reminded_at = ? WHERE email = ?`)
        .bind(Date.now(), user.email)
        .run()
      sent++
    } catch (e) {
      console.error(`herinnering aan ${user.email} mislukt`, e)
    }
  }

  return json({ ok: true, sent })
}
