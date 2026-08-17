import { EDITION_YEAR } from '../../../shared/products'
import { allSeatIds, buildRoom } from '../../../shared/seatmap'
import { emailFromRequest, emailsFor } from '../../../server/auth'
import { err, json } from '../../../server/http'
import { getOrder, getOrderItems, seatQuota } from '../../../server/orders'
import { EMAIL_RE, sendSeatInvite } from '../../../server/seatInvite'
import type { Env } from '../../../server/types'

type Body = { orderId?: string; seatId?: string; nickname?: string; email?: string }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const { orderId, seatId } = body
  const nickname = body.nickname?.trim() ?? ''
  // Optioneel: het adres van wie er zit (niet de koper). Die krijgt een
  // inloglink en beheert daarna zelf de naam op zijn plek.
  const invitedEmail = body.email?.trim().toLowerCase() ?? ''
  if (!orderId || !seatId) return err('Ongeldige aanvraag.')
  if (nickname.length < 2 || nickname.length > 20) {
    return err('Kies een naam van 2 tot 20 tekens.')
  }
  if (invitedEmail && !EMAIL_RE.test(invitedEmail)) return err('Geen geldig e-mailadres.')
  if (!allSeatIds().has(seatId)) return err('Die plek bestaat niet. Netjes proberen.')

  const order = await getOrder(env, orderId)
  if (!order) return err('Bestelling niet gevonden.', 404)
  if (order.status !== 'paid') return err('Eerst betalen, dan pas een plekje uitzoeken.', 403)

  // Claimt iemand anders dan de koper via de gedeelde ?order=-link, dan komt de
  // plek op zijn eigen naam te staan. Zo klopt de lijst zonder dat de koper
  // adressen hoeft in te tikken.
  const buyerEmail = order.email.toLowerCase()
  const sessionEmail = await emailFromRequest(env, request)
  const claimerIsBuyer = sessionEmail
    ? (await emailsFor(env, sessionEmail)).includes(buyerEmail)
    : true
  const ownerEmail =
    invitedEmail || (!claimerIsBuyer && sessionEmail ? sessionEmail : '')

  const items = await getOrderItems(env, orderId)
  const quota = seatQuota(items)

  const claimed = await env.DB.prepare(`SELECT COUNT(*) AS n FROM seats WHERE order_id = ?`)
    .bind(orderId)
    .first<{ n: number }>()
  if ((claimed?.n ?? 0) >= quota) {
    return err('Alle plekken van deze bestelling zijn al geclaimd.', 403)
  }

  try {
    await env.DB.prepare(
      `INSERT INTO seats (edition, seat_id, order_id, owner_email, nickname, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(EDITION_YEAR, seatId, orderId, ownerEmail || null, nickname, Date.now())
      .run()
  } catch (e) {
    if (String(e).includes('UNIQUE') || String(e).includes('PRIMARY KEY')) {
      return err('Deze plek is net ingepikt. Kies een andere.', 409)
    }
    throw e
  }

  // Alleen mailen als de koper expliciet een adres invulde; wie zelf claimt
  // zit al op de plattegrond en heeft geen uitnodiging nodig.
  let invited = false
  if (invitedEmail && invitedEmail !== buyerEmail) {
    const seatNo = buildRoom()
      .flat()
      .find((c) => c.seatId === seatId)?.seatNo
    try {
      await sendSeatInvite(env, {
        email: invitedEmail,
        origin: new URL(request.url).origin,
        seatNo: seatNo ?? 0,
        nickname,
        byName: order.name,
      })
      invited = true
    } catch (e) {
      console.error('plek-uitnodiging mailen mislukt', e)
    }
  }

  return json({ ok: true, invited })
}
