import { getMolliePayment, isFullyRefunded, mapMollieStatus } from '../../../server/mollie'
import { markOrderPaid, markOrderRefunded } from '../../../server/orders'
import type { Env } from '../../../server/types'

/**
 * Mollie POST't hier (form-encoded) alleen een payment-id; de status halen we
 * zelf veilig op bij de API. Altijd 200 teruggeven, anders blijft Mollie proberen.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData().catch(() => null)
  const paymentId = form?.get('id')
  if (typeof paymentId !== 'string' || !paymentId) return new Response('OK')

  try {
    const payment = await getMolliePayment(env, paymentId)
    const orderId = payment.metadata?.orderId
    if (!orderId) return new Response('OK')

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
  } catch (e) {
    console.error('mollie webhook', e)
    return new Response('ERROR', { status: 500 }) // Mollie probeert het dan opnieuw
  }
  return new Response('OK')
}
