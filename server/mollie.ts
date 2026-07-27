import type { Env } from './types'

const API = 'https://api.mollie.com/v2'

export type MolliePayment = {
  id: string
  status: string
  amount?: { value: string; currency: string }
  amountRefunded?: { value: string; currency: string }
  metadata?: { orderId?: string } | null
  _links?: { checkout?: { href: string } }
}

/** Volledig terugbetaald? Dan geven we de plek en voorraad weer vrij. */
export function isFullyRefunded(payment: MolliePayment): boolean {
  const refunded = Number(payment.amountRefunded?.value ?? '0')
  const total = Number(payment.amount?.value ?? '0')
  return total > 0 && refunded >= total
}

async function mollie(env: Env, path: string, init?: RequestInit): Promise<MolliePayment> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.MOLLIE_API_KEY}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`Mollie ${path}: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as MolliePayment
}

export async function createMolliePayment(
  env: Env,
  opts: {
    amountCents: number
    description: string
    redirectUrl: string
    webhookUrl?: string
    orderId: string
  },
): Promise<{ id: string; checkoutUrl: string }> {
  const payment = await mollie(env, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: { currency: 'EUR', value: (opts.amountCents / 100).toFixed(2) },
      description: opts.description,
      redirectUrl: opts.redirectUrl,
      // Mollie weigert localhost-webhooks; lokaal laten we hem weg en synct
      // de bedankt-pagina de status via de API (zie functions/api/order/[id].ts).
      ...(opts.webhookUrl ? { webhookUrl: opts.webhookUrl } : {}),
      metadata: { orderId: opts.orderId },
    }),
  })
  const checkoutUrl = payment._links?.checkout?.href
  if (!checkoutUrl) throw new Error('Mollie gaf geen checkout-URL terug')
  return { id: payment.id, checkoutUrl }
}

export function getMolliePayment(env: Env, paymentId: string): Promise<MolliePayment> {
  return mollie(env, `/payments/${paymentId}`)
}

/** Mollie-status → onze orderstatus (null = geen wijziging nodig) */
export function mapMollieStatus(status: string): 'paid' | 'failed' | 'canceled' | 'expired' | null {
  switch (status) {
    case 'paid':
      return 'paid'
    case 'failed':
      return 'failed'
    case 'canceled':
      return 'canceled'
    case 'expired':
      return 'expired'
    default:
      return null // open, pending, authorized → nog even afwachten
  }
}
