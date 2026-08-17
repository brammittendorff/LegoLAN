import { EDITION_YEAR } from '../../../shared/products'
import { buildRoom } from '../../../shared/seatmap'
import { emailFromRequest, emailsFor } from '../../../server/auth'
import { err, json } from '../../../server/http'
import { getOrder } from '../../../server/orders'
import { EMAIL_RE, sendSeatInvite } from '../../../server/seatInvite'
import type { Env } from '../../../server/types'

type Body = { orderId?: string; seatId?: string; nickname?: string; email?: string }
type SeatRow = { order_id: string | null; owner_email: string | null; nickname: string }

/**
 * Een eigen plek bijwerken: de naam die op de plattegrond staat, en (voor de
 * koper) het e-mailadres van wie er zit.
 *
 * Twee mensen mogen erbij: de koper (die het order-id kent, uit de mail of
 * zijn sessie) en de bezoeker aan wie de plek gekoppeld is. Die laatste mag
 * alleen zijn naam wijzigen, niet de koppeling zelf.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const { orderId, seatId } = body
  const nickname = body.nickname?.trim() ?? ''
  if (!seatId) return err('Ongeldige aanvraag.')
  if (nickname.length < 2 || nickname.length > 20) {
    return err('Kies een naam van 2 tot 20 tekens.')
  }

  const seat = await env.DB.prepare(
    `SELECT order_id, owner_email, nickname FROM seats WHERE edition = ? AND seat_id = ?`,
  )
    .bind(EDITION_YEAR, seatId)
    .first<SeatRow>()
  if (!seat) return err('Deze plek is niet geclaimd.', 404)

  const isBuyer = Boolean(orderId && seat.order_id === orderId)
  let isOwner = false
  if (!isBuyer && seat.owner_email) {
    const sessionEmail = await emailFromRequest(env, request)
    if (sessionEmail) {
      const emails = await emailsFor(env, sessionEmail)
      isOwner = emails.includes(seat.owner_email)
    }
  }
  if (!isBuyer && !isOwner) return err('Deze plek hoort niet bij jouw bestelling.', 403)

  // Alleen de koper koppelt adressen; wie de plek toegestuurd kreeg raakt de
  // koppeling niet aan (anders kan hij zijn plek aan een vreemde doorgeven).
  const wantsEmailChange = isBuyer && body.email !== undefined
  const newEmail = body.email?.trim().toLowerCase() ?? ''
  if (wantsEmailChange && newEmail && !EMAIL_RE.test(newEmail)) {
    return err('Geen geldig e-mailadres.')
  }

  if (wantsEmailChange) {
    await env.DB.prepare(
      `UPDATE seats SET nickname = ?, owner_email = ? WHERE edition = ? AND seat_id = ?`,
    )
      .bind(nickname, newEmail || null, EDITION_YEAR, seatId)
      .run()
  } else {
    await env.DB.prepare(`UPDATE seats SET nickname = ? WHERE edition = ? AND seat_id = ?`)
      .bind(nickname, EDITION_YEAR, seatId)
      .run()
  }

  // Nieuw gekoppeld adres? Dan een inloglink, zodat hij zijn eigen naam kan zetten.
  let invited = false
  const order = seat.order_id ? await getOrder(env, seat.order_id) : null
  if (
    wantsEmailChange &&
    newEmail &&
    newEmail !== seat.owner_email &&
    newEmail !== order?.email.toLowerCase()
  ) {
    const seatNo = buildRoom()
      .flat()
      .find((c) => c.seatId === seatId)?.seatNo
    try {
      await sendSeatInvite(env, {
        email: newEmail,
        origin: new URL(request.url).origin,
        seatNo: seatNo ?? 0,
        nickname,
        byName: order?.name,
      })
      invited = true
    } catch (e) {
      console.error('plek-uitnodiging mailen mislukt', e)
    }
  }

  return json({ ok: true, invited })
}
