import {
  bookedDaysFor,
  CAPACITY_POOLS,
  daysKey,
  EDITION_YEAR,
  getProduct,
  parseDays,
  SEATS_TOTAL,
  seatsFromSold,
} from '../../shared/products'
import { err, json } from '../../server/http'
import { createMolliePayment } from '../../server/mollie'
import { bookedPerPoolDay, expireStalePending, markOrderPaid, soldCounts } from '../../server/orders'
import { verifyTurnstile } from '../../server/turnstile'
import type { Env } from '../../server/types'

type Body = {
  firstName?: string
  lastName?: string
  email?: string
  turnstileToken?: string
  items?: { productId?: string; size?: string; customName?: string; qty?: number }[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return err('Ongeldige aanvraag.')
  }

  const firstName = body.firstName?.trim() ?? ''
  const lastName = body.lastName?.trim() ?? ''
  const email = body.email?.trim() ?? ''
  if (firstName.length < 2 || firstName.length > 40) return err('Vul je voornaam in.')
  if (lastName.length < 2 || lastName.length > 40) return err('Vul je achternaam in.')
  if (!EMAIL_RE.test(email)) return err('Vul een geldig e-mailadres in.')
  const name = `${firstName} ${lastName}`

  // Anti-bot: zonder Turnstile zou een script de hele voorraad in
  // pending-reserveringen kunnen gijzelen.
  const human = await verifyTurnstile(
    env,
    body.turnstileToken ?? '',
    request.headers.get('cf-connecting-ip') ?? undefined,
  )
  if (!human) return err('De spamcheck vertrouwt je niet. Probeer het opnieuw.', 403)
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 20) {
    return err('Je mandje is leeg of te vol.')
  }

  // Prijzen komen uit de catalogus op de server - nooit uit de browser.
  const lines: {
    productId: string
    size: string | null
    customName: string | null
    qty: number
    priceCents: number
  }[] = []
  for (const item of body.items) {
    const product = item.productId ? getProduct(item.productId) : undefined
    if (!product) return err('Onbekend product in je mandje.')
    const qty = item.qty
    if (!Number.isInteger(qty) || qty === undefined || qty < 1 || qty > 10) {
      return err(`Ongeldig aantal voor ${product.name.nl}.`)
    }
    if (product.sizes) {
      if (!item.size || !product.sizes.includes(item.size)) {
        return err(`Kies een maat voor ${product.name.nl}.`)
      }
    }
    let size = product.sizes ? item.size! : null
    let priceCents = product.priceCents
    if (product.perDay) {
      const days = parseDays(item.size)
      if (!days) return err(`Kies minstens één dag voor ${product.name.nl}.`)
      size = daysKey(days)
      priceCents = product.priceCents * days.length
    }
    const customName = item.customName?.trim() ?? ''
    if (product.needsCustomName && (customName.length < 2 || customName.length > 20)) {
      return err(`Vul een naam (2-20 tekens) in voor de opdruk van ${product.name.nl}.`)
    }
    lines.push({
      productId: product.id,
      size,
      customName: product.needsCustomName ? customName : null,
      qty,
      priceCents,
    })
  }

  await expireStalePending(env)

  // Voorraadcheck voor producten met beperkte capaciteit
  const sold = await soldCounts(env)
  const wanted = new Map<string, number>()
  for (const line of lines) {
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.qty)
  }
  for (const [productId, qty] of wanted) {
    const product = getProduct(productId)!
    if (product.capacity !== null && (sold[productId] ?? 0) + qty > product.capacity) {
      return err(`${product.name.nl} is uitverkocht (of er zijn er te weinig over).`, 409)
    }
  }

  // De zaal: elk ticket kost één plek op de plattegrond voor de hele editie,
  // of je nu het weekend blijft of één dag langskomt. Losse toewijzingen van de
  // admin bezetten dezelfde stoelen, dus die tellen mee.
  let wantedSeats = 0
  for (const [productId, qty] of wanted) {
    const product = getProduct(productId)!
    if (product.type === 'ticket') wantedSeats += (product.seatsPerUnit ?? 1) * qty
  }
  if (wantedSeats > 0) {
    const losseplekken = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM seats WHERE edition = ? AND order_id IS NULL`,
    )
      .bind(EDITION_YEAR)
      .first<{ n: number }>()
    const bezet = seatsFromSold(sold) + (losseplekken?.n ?? 0)
    if (bezet + wantedSeats > SEATS_TOTAL) {
      const over = Math.max(0, SEATS_TOTAL - bezet)
      return err(
        over === 0
          ? 'De zaal is vol. Mail ons als je er per se bij wilt zijn.'
          : `Er ${over === 1 ? 'is' : 'zijn'} nog maar ${over} plek${over === 1 ? '' : 'ken'} vrij in de zaal.`,
        409,
      )
    }
  }

  // Huur-PC's: 2 machines, geboekt per dag. Check per eventdag.
  const wantedPerDay = new Map<string, number>()
  for (const line of lines) {
    const product = getProduct(line.productId)!
    if (!product.pool) continue
    const days = bookedDaysFor(product, line.size)
    if (!days) return err(`Kies een dag voor ${product.name.nl}.`)
    for (const day of days) {
      const key = `${product.pool}:${day}`
      wantedPerDay.set(key, (wantedPerDay.get(key) ?? 0) + line.qty)
    }
  }
  if (wantedPerDay.size > 0) {
    const POOL_FULL: Record<string, (day: string) => string> = {
      computerhuur: (day) => `Alle huur-PC's zijn al geboekt op ${day}. Kies een andere dag.`,
    }
    const booked = await bookedPerPoolDay(env)
    for (const [key, qty] of wantedPerDay) {
      const [pool, day] = key.split(':')
      if ((booked[key] ?? 0) + qty > (CAPACITY_POOLS[pool] ?? 0)) {
        return err(POOL_FULL[pool]?.(day) ?? `Uitverkocht op ${day}.`, 409)
      }
    }
  }

  const orderId = crypto.randomUUID()
  const amountCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0)
  const origin = new URL(request.url).origin

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orders (id, created_at, status, name, first_name, last_name, email, amount_cents, edition)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
    ).bind(orderId, Date.now(), name, firstName, lastName, email, amountCents, EDITION_YEAR),
    ...lines.map((l) =>
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, size, custom_name, qty, price_cents)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(orderId, l.productId, l.size, l.customName, l.qty, l.priceCents),
    ),
  ])

  const redirectUrl = `${origin}/bedankt?order=${orderId}`

  // Nepbetaling voor lokaal testen: MOLLIE_API_KEY=fake in .dev.vars
  if (env.MOLLIE_API_KEY === 'fake') {
    await markOrderPaid(env, orderId, origin)
    return json({ checkoutUrl: redirectUrl })
  }
  if (!env.MOLLIE_API_KEY) {
    return err('Betalen is nog niet geconfigureerd. Probeer het later opnieuw.', 503)
  }

  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin)
  try {
    const payment = await createMolliePayment(env, {
      amountCents,
      description: `LEGOLAN bestelling ${orderId.slice(0, 8)}`,
      redirectUrl,
      webhookUrl: isLocal ? undefined : `${origin}/api/webhooks/mollie`,
      orderId,
    })
    await env.DB.prepare(`UPDATE orders SET mollie_payment_id = ? WHERE id = ?`)
      .bind(payment.id, orderId)
      .run()
    return json({ checkoutUrl: payment.checkoutUrl })
  } catch (e) {
    console.error('mollie payment aanmaken mislukt', e)
    return err('De betaalprovider doet moeilijk. Probeer het zo nog eens.', 502)
  }
}
