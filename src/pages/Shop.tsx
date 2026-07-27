import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PRODUCTS } from '../../shared/products'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import ProductCard from '../components/ProductCard'

export default function Shop() {
  const { t } = useLang()
  const [stock, setStock] = useState<Record<string, number | null>>()

  useEffect(() => {
    api
      .stock()
      .then((r) => setStock(r.stock))
      .catch(() => setStock({}))
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="text-center">
        <h1 className="neon-script text-6xl md:text-7xl">{t('de shop', 'the shop')}</h1>
        <p className="mt-4 text-smoke/80">
          {t(
            "Tickets, extra's en merch. Betalen gaat gewoon netjes via iDEAL - geen briefjes.",
            'Tickets, extras and merch. Payment is handled properly via iDEAL - no bills in strings.',
          )}
        </p>
      </header>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} remaining={stock?.[p.id]} />
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-smoke/70">
        {t('Ticket gekocht? Daarna claim je je plek op', 'Bought a ticket? Then claim your spot on')}{' '}
        <Link to="/zaal" className="text-neon hover:underline">
          {t('de plattegrond', 'the floor plan')}
        </Link>
        . {t('Polo besteld? We mailen je over de opdruk.', 'Ordered a polo? We will email you about the print.')}
      </p>
    </div>
  )
}
