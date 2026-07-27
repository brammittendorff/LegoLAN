import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type OrderInfo } from '../lib/api'
import { useCart } from '../lib/cart'
import { euro } from '../lib/money'
import { useLang } from '../lib/i18n'

const POLL_MS = 2500
const MAX_POLLS = 40 // ± 100 seconden

export default function Bedankt() {
  const { t, pick } = useLang()
  const [params] = useSearchParams()
  const orderId = params.get('order')
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [gaveUp, setGaveUp] = useState(false)
  const { clear } = useCart()
  const cleared = useRef(false)

  useEffect(() => {
    if (!orderId) return
    let polls = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const poll = async () => {
      try {
        const info = await api.order(orderId)
        if (stopped) return
        setOrder(info)
        if (info.status === 'pending') {
          polls += 1
          if (polls >= MAX_POLLS) return setGaveUp(true)
          timer = setTimeout(() => void poll(), POLL_MS)
        }
      } catch {
        if (!stopped) setGaveUp(true)
      }
    }

    void poll()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [orderId])

  useEffect(() => {
    if (order?.status === 'paid' && orderId && !cleared.current) {
      cleared.current = true
      clear()
    }
  }, [order?.status, orderId, clear])

  if (!orderId) {
    return (
      <Wrap>
        <h1 className="neon-script text-6xl">{t('bedankt!', 'thank you!')}</h1>
        <p className="mt-6 text-smoke/80">
          {t('We hebben je bestelling ontvangen.', 'We have received your order.')}
        </p>
        <Link to="/" className="btn-neon mt-8">
          {t('Terug naar de club', 'Back to the club')}
        </Link>
      </Wrap>
    )
  }

  if (!order || (order.status === 'pending' && !gaveUp)) {
    return (
      <Wrap>
        <p className="font-display text-4xl neon-text flicker">€</p>
        <h1 className="mt-6 text-xl font-bold text-milk">
          {t('We checken je betaling...', 'Checking your payment...')}
        </h1>
        <p className="mt-2 text-sm text-smoke/70">
          {t('Even geduld, de uitsmijter kijkt je na.', 'One moment, the bouncer is looking you over.')}
        </p>
      </Wrap>
    )
  }

  if (order.status === 'paid') {
    const hasSeats = order.seatQuota > 0
    return (
      <Wrap>
        <h1 className="neon-script text-6xl md:text-7xl">
          {t('welkom bij de club', 'welcome to the club')}
        </h1>
        <p className="mt-6 text-smoke">
          {t(
            `Je betaling is binnen (${euro(order.amountCents)}). De bevestiging zit in je mail.`,
            `Your payment came through (${euro(order.amountCents)}). The confirmation is in your inbox.`,
          )}
        </p>
        <ul className="card-velvet mx-auto mt-6 max-w-sm space-y-1 p-4 text-sm text-smoke">
          {order.items.map((item, idx) => (
            <li key={idx}>
              {item.qty}× {pick(item.name)}
              {item.size ? ` (${item.size})` : ''}
              {item.customName ? ` · "${item.customName}"` : ''}
            </li>
          ))}
        </ul>
        {hasSeats && (
          <>
            <p className="mt-6 text-smoke/85">
              {t('Nu het belangrijkste: waar zit je?', 'Now for the important part: where are you sitting?')}
            </p>
            <Link to={`/zaal?order=${orderId}`} className="btn-neon mt-4">
              {t('Kies je plek in de zaal', 'Pick your seat in the hall')}
            </Link>
          </>
        )}
        <p className="mt-6">
          <Link to="/" className="text-sm text-smoke/60 hover:text-neon">
            {t('Terug naar home', 'Back to home')}
          </Link>
        </p>
      </Wrap>
    )
  }

  if (order.status === 'pending') {
    return (
      <Wrap>
        <h1 className="text-xl font-bold text-milk">
          {t('Je betaling is nog onderweg', 'Your payment is still on its way')}
        </h1>
        <p className="mt-4 text-smoke/80">
          {t(
            'Zodra die binnen is krijg je automatisch een mail met je bevestiging en de link om je plek te kiezen. Je mag dit tabblad sluiten.',
            'As soon as it arrives you will automatically get an email with your confirmation and the link to pick your seat. You can close this tab.',
          )}
        </p>
      </Wrap>
    )
  }

  if (order.status === 'refunded') {
    return (
      <Wrap>
        <h1 className="text-2xl font-bold text-milk">{t('Terugbetaald', 'Refunded')}</h1>
        <p className="mt-4 text-smoke/80">
          {t(
            'Deze bestelling is terugbetaald. Het bedrag staat (binnen een paar werkdagen) weer op je rekening.',
            'This order has been refunded. The amount will be back in your account within a few working days.',
          )}
        </p>
        <Link to="/shop" className="btn-neon mt-8">
          {t('Naar de shop', 'To the shop')}
        </Link>
      </Wrap>
    )
  }

  return (
    <Wrap>
      <h1 className="text-2xl font-bold text-milk">{t('Dat werd niks.', 'That did not work out.')}</h1>
      <p className="mt-4 text-smoke/80">
        {order.status === 'expired'
          ? t(
              'De betaling is verlopen. Geen zorgen - er is niets afgeschreven en je mag het gewoon nog een keer proberen.',
              'The payment expired. No worries - nothing was charged and you can simply try again.',
            )
          : t(
              'De betaling is niet gelukt. Geen zorgen - er is niets afgeschreven en je mag het gewoon nog een keer proberen.',
              'The payment failed. No worries - nothing was charged and you can simply try again.',
            )}
      </p>
      <Link to="/shop" className="btn-neon mt-8">
        {t('Opnieuw proberen', 'Try again')}
      </Link>
    </Wrap>
  )
}

function Wrap({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-xl px-6 py-24 text-center">{children}</div>
}
