import type { Env } from './types'

const configured = (env: Env): boolean => !!(env.MAILJET_API_KEY && env.MAILJET_API_SECRET)

const auth = (env: Env): string =>
  'Basic ' + btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_API_SECRET}`)

export async function sendMail(
  env: Env,
  opts: {
    toEmail: string
    toName?: string
    subject: string
    html: string
    text: string
    replyTo?: { email: string; name?: string }
  },
): Promise<void> {
  // Lokaal ontwikkelen: vang alle mail af in Mailpit in plaats van echt te versturen.
  if (env.MAILPIT_URL) {
    const res = await fetch(`${env.MAILPIT_URL.replace(/\/$/, '')}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: { Email: env.FROM_EMAIL || 'noreply@legolan.nl', Name: env.FROM_NAME || 'LEGOLAN' },
        To: [{ Email: opts.toEmail, Name: opts.toName ?? opts.toEmail }],
        Subject: opts.subject,
        Text: opts.text,
        HTML: opts.html,
        ...(opts.replyTo ? { ReplyTo: [{ Email: opts.replyTo.email, Name: opts.replyTo.name }] } : {}),
      }),
    })
    if (!res.ok) throw new Error(`Mailpit: ${res.status} ${await res.text()}`)
    return
  }
  if (!configured(env)) {
    console.log(`[mailjet uit] mail overgeslagen: "${opts.subject}" → ${opts.toEmail}`)
    return
  }
  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { authorization: auth(env), 'content-type': 'application/json' },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: env.FROM_EMAIL || 'noreply@legolan.nl', Name: env.FROM_NAME || 'LEGOLAN' },
          To: [{ Email: opts.toEmail, Name: opts.toName ?? opts.toEmail }],
          Subject: opts.subject,
          TextPart: opts.text,
          HTMLPart: opts.html,
          ...(opts.replyTo ? { ReplyTo: { Email: opts.replyTo.email, Name: opts.replyTo.name } } : {}),
        },
      ],
    }),
  })
  if (!res.ok) {
    throw new Error(`Mailjet send: ${res.status} ${await res.text()}`)
  }
}

export async function addToNewsletter(env: Env, email: string): Promise<void> {
  if (env.MAILPIT_URL) {
    // Lokaal: geen echte lijst - stuur een controle-mailtje naar Mailpit.
    await sendMail(env, {
      toEmail: email,
      subject: '[dev] Nieuwsbrief-inschrijving',
      text: `Zou zijn ingeschreven op de Mailjet-lijst: ${email}`,
      html: `<p>Zou zijn ingeschreven op de Mailjet-lijst: <strong>${email}</strong></p>`,
    })
    return
  }
  if (!configured(env) || !env.MAILJET_LIST_ID) {
    console.log(`[mailjet uit] inschrijving overgeslagen: ${email}`)
    return
  }
  const res = await fetch(
    `https://api.mailjet.com/v3/REST/contactslist/${env.MAILJET_LIST_ID}/managecontact`,
    {
      method: 'POST',
      headers: { authorization: auth(env), 'content-type': 'application/json' },
      body: JSON.stringify({ Email: email, Action: 'addnoforce' }),
    },
  )
  if (!res.ok) {
    throw new Error(`Mailjet lijst: ${res.status} ${await res.text()}`)
  }
}
