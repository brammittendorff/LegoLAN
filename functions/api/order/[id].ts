import { getProduct } from '../../../shared/products'
import { err, json } from '../../../server/http'
import { getMolliePayment, isFullyRefunded, mapMollieStatus } from '../../../server/mollie'
import {
  PENDING_TTL_MS,
  getOrder,
  getOrderItems,
  markOrderPaid,
  markOrderRefunded,
  seatQuota,
} from '../../../server/orders'
import type { Env } from '../../../server/types'

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const orderId = String(params.id ?? '')
  if (!orderId) return err('Geen order-id.', 404)

  let order = await getOrder(env, orderId)
  if (!order) return err('Bestelling niet gevonden.', 404)

  // Vangnet voor gemiste webhooks (en lokaal, waar Mollie ons niet kan bereiken):
  // bij een pending order even live bij Mollie kijken.
  if (order.status === 'pending' && order.mollie_payment_id && env.MOLLIE_API_KEY !== 'fake') {
    try {
      const payment = await getMolliePayment(env, order.mollie_payment_id)
      const status = mapMollieStatus(payment.status)
      if (status === 'paid' && isFullyRefunded(payment)) {
        await markOrderRefunded(env, orderId)
      } else if (status === 'paid') {
        await markOrderPaid(env, orderId, new URL(request.url).origin)
      } else if (status) {
        await env.DB.prepare(`UPDATE orders SET status = ? WHERE id = ? AND status = 'pending'`)
          .bind(status, orderId)
          .run()
      }
      order = (await getOrder(env, orderId)) ?? order
    } catch (e) {
      console.error('mollie status sync', e)
    }
  }

  if (order.status === 'pending' && order.created_at < Date.now() - PENDING_TTL_MS) {
    await env.DB.prepare(`UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'pending'`)
      .bind(orderId)
      .run()
    order = { ...order, status: 'expired' }
  }

  const items = await getOrderItems(env, orderId)
  const seatsClaimed = await env.DB.prepare(
    `SELECT seat_id AS seatId, nickname FROM seats WHERE order_id = ?`,
  )
    .bind(orderId)
    .all<{ seatId: string; nickname: string }>()

  return json({
    status: order.status,
    amountCents: order.amount_cents,
    items: items.map((i) => ({
      name: getProduct(i.product_id)?.name ?? { nl: i.product_id, en: i.product_id },
      qty: i.qty,
      size: i.size ?? undefined,
      customName: i.custom_name ?? undefined,
    })),
    seatQuota: order.status === 'paid' ? seatQuota(items) : 0,
    seatsClaimed: seatsClaimed.results,
  })
}
