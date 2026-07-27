import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { getProduct, linePriceCents } from '../../shared/products'
import { euro } from '../lib/money'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import Turnstile from '../components/Turnstile'

export default function Checkout() {
  const { items, totalCents } = useCart()
  const { t, pick } = useLang()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()

  // Ingelogd? Dan staan je gegevens er alvast.
  useEffect(() => {
    if (!user) return
    setFirstName((prev) => prev || user.firstName)
    setLastName((prev) => prev || user.lastName)
    setEmail((prev) => prev || user.email)
  }, [user])

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="neon-script text-5xl">{t('afrekenen', 'checkout')}</h1>
        <p className="mt-6 text-smoke/80">
          {t(
            'Je mandje is leeg. Zo blijft het een goedkope avond.',
            'Your cart is empty. Cheapest night out ever.',
          )}
        </p>
        <Link to="/shop" className="btn-neon mt-8">
          {t('Naar de shop', 'To the shop')}
        </Link>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { checkoutUrl } = await api.checkout({
        firstName,
        lastName,
        email,
        turnstileToken: token,
        items: items.map(({ productId, size, customName, qty }) => ({ productId, size, customName, qty })),
      })
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Er ging iets mis.', 'Something went wrong.'))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="neon-script text-center text-5xl md:text-6xl">{t('afrekenen', 'checkout')}</h1>

      <div className="card-velvet mt-10 p-6">
        <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
          {t('Je bestelling', 'Your order')}
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((item) => {
            const product = getProduct(item.productId)
            if (!product) return null
            return (
              <li
                key={`${item.productId}-${item.size ?? ''}-${item.customName ?? ''}`}
                className="flex justify-between"
              >
                <span className="text-milk">
                  {item.qty}× {pick(product.name)}
                  {item.size ? ` (${item.size})` : ''}
                  {item.customName ? ` · "${item.customName}"` : ''}
                </span>
                <span className="font-label text-smoke">
                  {euro(linePriceCents(product, item.size) * item.qty)}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 flex justify-between border-t border-grape/30 pt-3 font-semibold text-milk">
          <span>{t('Totaal', 'Total')}</span>
          <span className="font-label text-bulb">{euro(totalCents)}</span>
        </div>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="voornaam" className="mb-1 block text-sm text-smoke">
              {t('Voornaam', 'First name')}
            </label>
            <input
              id="voornaam"
              required
              minLength={2}
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="achternaam" className="mb-1 block text-sm text-smoke">
              {t('Achternaam', 'Last name')}
            </label>
            <input
              id="achternaam"
              required
              minLength={2}
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-smoke">
            {t(
              'E-mail (hier komt je bevestiging + plattegrond-link)',
              'Email (your confirmation + floor plan link go here)',
            )}
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <Turnstile onToken={setToken} />

        {error && <p className="text-sm text-neon-soft">{error}</p>}

        <button type="submit" className="btn-neon w-full" disabled={busy || !token}>
          {busy ? t('Momentje...', 'One moment...') : `${t('Betalen', 'Pay')} · ${euro(totalCents)}`}
        </button>
        <p className="text-center text-xs text-smoke/60">
          {t(
            'Je wordt doorgestuurd naar Mollie voor een veilige betaling (iDEAL en meer).',
            'You will be redirected to Mollie for a secure payment (iDEAL and more).',
          )}
        </p>
      </form>
    </div>
  )
}
