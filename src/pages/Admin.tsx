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
  const [busyOrder, setBusyOrder] = useState('')
  const [poloEdits, setPoloEdits] = useState<Record<number, { customName: string; size: string }>>({})
  const [busyPolo, setBusyPolo] = useState(0)
  const [tab, setTab] = useState<'verkoop' | 'gebruikers'>('verkoop')
  const [users, setUsers] = useState<Awaited<ReturnType<typeof api.adminUsers>>['users'] | null>(null)
  const [newAdmin, setNewAdmin] = useState('')
  const [busyUser, setBusyUser] = useState('')

  const isAdmin = user?.role === 'admin'

  const load = () =>
    api
      .adminOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'fout'))

  const loadUsers = () =>
    api
      .adminUsers()
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e instanceof Error ? e.message : 'fout'))

  useEffect(() => {
    if (!isAdmin) return
    if (tab === 'verkoop') void load()
    else void loadUsers()
  }, [isAdmin, tab])

  const setRole = async (email: string, role: 'user' | 'admin') => {
    if (
      role === 'user' &&
      !window.confirm(t(`${email} de admin-rol afnemen?`, `Remove admin role from ${email}?`))
    ) {
      return
    }
    setBusyUser(email)
    setError('')
    try {
      await api.adminSetRole({ email, role })
      setNewAdmin('')
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fout')
    } finally {
      setBusyUser('')
    }
  }

  const releaseSeat = async (seatId: string) => {
    setBusySeat(seatId)
    try {
      await api.adminReleaseSeat(seatId)
      await load()
    } finally {
      setBusySeat('')
    }
  }

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm(t('Deze pending bestelling annuleren?', 'Cancel this pending order?'))) return
    setBusyOrder(orderId)
    try {
      await api.adminCancelOrder(orderId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fout')
    } finally {
      setBusyOrder('')
    }
  }

  const savePolo = async (itemId: number) => {
    const edit = poloEdits[itemId]
    if (!edit) return
    setBusyPolo(itemId)
    try {
      await api.adminUpdatePolo({ itemId, customName: edit.customName, size: edit.size })
      setPoloEdits((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fout')
    } finally {
      setBusyPolo(0)
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

      <div className="mt-8 flex justify-center gap-3">
        {(['verkoop', 'gebruikers'] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`rounded-full border px-4 py-1.5 font-label text-xs uppercase tracking-widest transition-colors ${
              tab === tabKey
                ? 'border-neon text-neon'
                : 'border-smoke/30 text-smoke hover:border-neon hover:text-milk'
            }`}
          >
            {tabKey === 'verkoop' ? t('Verkoop', 'Sales') : t('Gebruikers', 'Users')}
          </button>
        ))}
      </div>

      {error && <p className="mt-8 text-center text-neon-soft">{error}</p>}

      {tab === 'gebruikers' && (
        <section className="mt-10">
          <div className="card-velvet mx-auto max-w-xl p-6">
            <p className="text-sm text-smoke">
              {t(
                'Maak iemand admin op e-mailadres (hoeft nog geen account te hebben):',
                'Grant admin by email address (an account is not required yet):',
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                className="input flex-1"
                placeholder="crew@voorbeeld.nl"
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
              />
              <button
                type="button"
                className="btn-neon !px-4 !py-2 text-sm"
                disabled={!newAdmin.includes('@') || busyUser !== ''}
                onClick={() => void setRole(newAdmin, 'admin')}
              >
                {t('Maak admin', 'Make admin')}
              </button>
            </div>
          </div>

          <ul className="card-velvet mx-auto mt-6 max-w-3xl divide-y divide-grape/20 p-2 text-sm">
            {(users ?? []).map((u) => (
              <li key={u.email} className="flex flex-wrap items-center gap-3 px-2 py-2">
                <span
                  className={`font-label text-[10px] uppercase tracking-widest ${
                    u.role === 'admin' ? 'text-neon' : 'text-smoke/50'
                  }`}
                >
                  {u.role}
                </span>
                <span className="text-milk">
                  {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.nickname || '-'}
                </span>
                <span className="flex-1 truncate text-smoke/70">{u.email}</span>
                {u.editions && (
                  <span className="font-label text-xs text-bulb">{u.editions}</span>
                )}
                {u.email !== user.email && (
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1 text-xs"
                    disabled={busyUser === u.email}
                    onClick={() => void setRole(u.email, u.role === 'admin' ? 'user' : 'admin')}
                  >
                    {u.role === 'admin' ? t('Rol afnemen', 'Remove admin') : t('Maak admin', 'Make admin')}
                  </button>
                )}
              </li>
            ))}
            {users !== null && users.length === 0 && (
              <li className="px-2 py-2 text-smoke/60">{t('Nog geen accounts.', 'No accounts yet.')}</li>
            )}
          </ul>
          <p className="mx-auto mt-3 max-w-3xl text-xs text-smoke/60">
            {t(
              'Alleen mensen met een account staan hier; deelnemers zonder account verschijnen zodra ze een keer inloggen of registreren.',
              'Only people with an account are listed; attendees without one appear once they sign in or register.',
            )}
          </p>
        </section>
      )}

      {tab === 'verkoop' && data && (
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
            <div className="flex items-center justify-between">
              <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
                {t('Plekken', 'Seats')} ({data.seats.length})
              </h2>
              <a href="/api/admin/export?type=seats" className="btn-ghost !px-3 !py-1 text-xs">
                Export CSV
              </a>
            </div>
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
            <div className="flex items-center justify-between">
              <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
                {t("Polo's (opdruk)", 'Polos (print)')} ({data.polos.length})
              </h2>
              <a href="/api/admin/export?type=polos" className="btn-ghost !px-3 !py-1 text-xs">
                Export CSV
              </a>
            </div>
            <ul className="card-velvet mt-4 divide-y divide-grape/20 p-2 text-sm">
              {data.polos.map((p) => {
                const edit = poloEdits[p.itemId]
                return (
                  <li key={p.itemId} className="flex flex-wrap items-center gap-3 px-2 py-2">
                    <span className="font-label text-bulb">{p.qty}×</span>
                    {edit ? (
                      <>
                        <select
                          className="input !w-20 !py-1"
                          value={edit.size}
                          onChange={(e) =>
                            setPoloEdits((prev) => ({ ...prev, [p.itemId]: { ...edit, size: e.target.value } }))
                          }
                        >
                          {['S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <input
                          className="input !w-44 !py-1"
                          maxLength={20}
                          value={edit.customName}
                          onChange={(e) =>
                            setPoloEdits((prev) => ({
                              ...prev,
                              [p.itemId]: { ...edit, customName: e.target.value },
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="btn-neon !px-3 !py-1 text-xs"
                          disabled={busyPolo === p.itemId}
                          onClick={() => void savePolo(p.itemId)}
                        >
                          {t('Opslaan', 'Save')}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-label text-bulb">{p.size}</span>
                        <span className="text-milk">"{p.customName}"</span>
                        <span className="flex-1 truncate text-smoke/70">
                          {p.name} · {p.email}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost !px-3 !py-1 text-xs"
                          onClick={() =>
                            setPoloEdits((prev) => ({
                              ...prev,
                              [p.itemId]: { customName: p.customName, size: p.size ?? 'L' },
                            }))
                          }
                        >
                          {t('Wijzig', 'Edit')}
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
              {data.polos.length === 0 && (
                <li className="px-2 py-2 text-smoke/60">{t('Nog geen polo besteld.', 'No polos ordered yet.')}</li>
              )}
            </ul>
          </section>

          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
                {t('Bestellingen', 'Orders')} ({data.orders.length})
              </h2>
              <a href="/api/admin/export?type=orders" className="btn-ghost !px-3 !py-1 text-xs">
                Export CSV
              </a>
            </div>
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
                        {o.status === 'pending' && (
                          <button
                            type="button"
                            className="btn-ghost ml-2 !px-2 !py-0.5 text-xs"
                            disabled={busyOrder === o.id}
                            onClick={() => void cancelOrder(o.id)}
                          >
                            {t('Annuleren', 'Cancel')}
                          </button>
                        )}
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
