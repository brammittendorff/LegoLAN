import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProduct } from '../../shared/products'
import { buildRoom } from '../../shared/seatmap'
import { api, type AdminOverview } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLang } from '../lib/i18n'
import { euro } from '../lib/money'

export default function Admin() {
  const { t, pick } = useLang()
  const { user, loading } = useAuth()
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [busySeat, setBusySeat] = useState('')

  const isAdmin = user?.role === 'admin'

  const load = () =>
    api
      .adminOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'fout'))

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin])

  const releaseSeat = async (seatId: string) => {
    setBusySeat(seatId)
    try {
      await api.adminReleaseSeat(seatId)
      await load()
    } finally {
      setBusySeat('')
    }
  }

  const seatNo = (seatId: string) =>
    buildRoom()
      .flat()
      .find((c) => c.seatId === seatId)?.seatNo

  const productName = (id: string) => {
    const p = getProduct(id)
    return p ? pick(p.name) : id
  }

  if (loading) {
    return <Wrap>{t('Laden...', 'Loading...')}</Wrap>
  }
  if (!user || !isAdmin) {
    return (
      <Wrap>
        {t('Deze kamer is alleen voor de crew.', 'This room is crew only.')}{' '}
        <Link to="/account" className="text-neon hover:underline">
          {t('Inloggen', 'Sign in')}
        </Link>
      </Wrap>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="text-center">
        <h1 className="neon-script text-6xl md:text-7xl">backstage</h1>
        <p className="mt-4 text-smoke/80">
          {t(`Beheer voor editie ${data?.edition ?? ''}`, `Admin for edition ${data?.edition ?? ''}`)}
        </p>
      </header>

      {error && <p className="mt-8 text-center text-neon-soft">{error}</p>}

      {data && (
        <>
          <section className="mt-12">
            <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
              {t('Verkoop (betaald)', 'Sales (paid)')}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.stats.map((s) => (
                <div key={s.productId} className="card-velvet p-4">
                  <p className="text-sm text-smoke">{productName(s.productId)}</p>
                  <p className="mt-1 text-xl font-bold text-milk">{s.sold}×</p>
                  <p className="font-label text-xs text-bulb">{euro(s.revenueCents)}</p>
                </div>
              ))}
              <div className="card-velvet p-4">
                <p className="text-sm text-smoke">{t('Totaal omzet', 'Total revenue')}</p>
                <p className="mt-1 text-xl font-bold text-milk">
                  {euro(data.stats.reduce((n, s) => n + s.revenueCents, 0))}
                </p>
                <p className="font-label text-xs text-bulb">
                  {t('deelnemers per editie:', 'attendees per edition:')}{' '}
                  {data.attendees.map((a) => `${a.edition}: ${a.n}`).join(' · ')}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
              {t('Plekken', 'Seats')} ({data.seats.length})
            </h2>
            <ul className="card-velvet mt-4 divide-y divide-grape/20 p-2 text-sm">
              {data.seats.map((s) => (
                <li key={s.seatId} className="flex items-center gap-3 px-2 py-2">
                  <span className="font-label text-bulb">#{seatNo(s.seatId)}</span>
                  <span className="text-milk">{s.nickname}</span>
                  <span className="flex-1 truncate text-smoke/70">
                    {s.name} · {s.email}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1 text-xs"
                    disabled={busySeat === s.seatId}
                    onClick={() => void releaseSeat(s.seatId)}
                  >
                    {t('Vrijgeven', 'Release')}
                  </button>
                </li>
              ))}
              {data.seats.length === 0 && (
                <li className="px-2 py-2 text-smoke/60">{t('Nog niets geclaimd.', 'Nothing claimed yet.')}</li>
              )}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
              {t("Polo's (opdruk)", 'Polos (print)')} ({data.polos.length})
            </h2>
            <ul className="card-velvet mt-4 divide-y divide-grape/20 p-2 text-sm">
              {data.polos.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-2 py-2">
                  <span className="font-label text-bulb">{p.qty}× {p.size}</span>
                  <span className="text-milk">"{p.customName}"</span>
                  <span className="flex-1 truncate text-smoke/70">
                    {p.name} · {p.email}
                  </span>
                </li>
              ))}
              {data.polos.length === 0 && (
                <li className="px-2 py-2 text-smoke/60">{t('Nog geen polo besteld.', 'No polos ordered yet.')}</li>
              )}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
              {t('Bestellingen', 'Orders')} ({data.orders.length})
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="card-velvet w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="font-label text-[11px] uppercase tracking-widest text-smoke/60">
                    <th className="px-3 py-2">{t('Datum', 'Date')}</th>
                    <th className="px-3 py-2">{t('Naam', 'Name')}</th>
                    <th className="px-3 py-2">{t('Items', 'Items')}</th>
                    <th className="px-3 py-2">{t('Bedrag', 'Amount')}</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-t border-grape/20">
                      <td className="whitespace-nowrap px-3 py-2 text-smoke/70">
                        {new Date(o.createdAt).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-3 py-2 text-milk">
                        {o.name}
                        <span className="block text-xs text-smoke/60">{o.email}</span>
                      </td>
                      <td className="px-3 py-2 text-smoke/80">{o.items}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-label text-bulb">
                        {euro(o.amountCents)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            o.status === 'paid'
                              ? 'text-bulb'
                              : o.status === 'pending'
                                ? 'text-smoke/70'
                                : 'text-neon-soft'
                          }
                        >
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-smoke/60">
              {t(
                'Terugbetalen doe je in het Mollie-dashboard; de site verwerkt dat automatisch.',
                'Refunds happen in the Mollie dashboard; the site processes them automatically.',
              )}
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-6 py-24 text-center text-smoke">{children}</div>
}
