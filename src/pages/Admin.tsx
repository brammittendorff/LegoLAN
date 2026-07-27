import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EDITION_YEAR, getProduct } from '../../shared/products'
import { buildRoom } from '../../shared/seatmap'
import { api, type AdminOverview, type AdminStats, type DayPoint } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLang } from '../lib/i18n'
import { euro } from '../lib/money'

// Edities die je in Gebruikers kunt aanvinken (2024 = eerste editie in het systeem)
const EDITIE_JAREN = Array.from({ length: EDITION_YEAR - 2024 + 1 }, (_, i) => 2024 + i)

type UserEdit = { firstName: string; lastName: string; nickname: string; editions: number[]; aliases: string }
type Tab = 'verkoop' | 'plekken' | 'polos' | 'gebruikers' | 'grafieken'

export default function Admin() {
  const { t, pick } = useLang()
  const { user, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('verkoop')
  const [data, setData] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<Awaited<ReturnType<typeof api.adminUsers>>['users'] | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [newAdmin, setNewAdmin] = useState('')
  const [poloEdits, setPoloEdits] = useState<Record<number, { customName: string; size: string }>>({})
  const [userEdits, setUserEdits] = useState<Record<string, UserEdit>>({})

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

  const loadStats = () =>
    api
      .adminStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'fout'))

  useEffect(() => {
    if (!isAdmin) return
    setError('')
    if (tab === 'gebruikers') void loadUsers()
    else if (tab === 'grafieken') void loadStats()
    else void load()
  }, [isAdmin, tab])

  const run = async (key: string, fn: () => Promise<unknown>, reload: () => Promise<unknown>) => {
    setBusy(key)
    setError('')
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fout')
    } finally {
      setBusy('')
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

  if (loading) return <Wrap>{t('Laden...', 'Loading...')}</Wrap>
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'verkoop', label: t('Verkoop', 'Sales') },
    { key: 'plekken', label: t('Plekken', 'Seats') },
    { key: 'polos', label: "Polo's" },
    { key: 'gebruikers', label: t('Gebruikers', 'Users') },
    { key: 'grafieken', label: t('Grafieken', 'Charts') },
  ]

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="text-center">
        <h1 className="neon-script text-6xl md:text-7xl">backstage</h1>
        <p className="mt-4 text-smoke/80">
          {t(`Beheer voor editie ${EDITION_YEAR}`, `Admin for edition ${EDITION_YEAR}`)}
        </p>
      </header>

      <nav className="mt-8 flex flex-wrap justify-center gap-3" aria-label="Backstage">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full border px-4 py-1.5 font-label text-xs uppercase tracking-widest transition-colors ${
              tab === key
                ? 'border-neon text-neon'
                : 'border-smoke/30 text-smoke hover:border-neon hover:text-milk'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p className="mt-8 text-center text-neon-soft">{error}</p>}

      {/* ------------------------------------------------ Verkoop */}
      {tab === 'verkoop' && data && (
        <>
          <section className="mt-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  {t('deelnemers:', 'attendees:')}{' '}
                  {data.attendees.map((a) => `${a.edition}: ${a.n}`).join(' · ')}
                </p>
              </div>
            </div>
          </section>

          <TableSection
            title={`${t('Bestellingen', 'Orders')} (${data.orders.length})`}
            exportType="orders"
          >
            <table className="card-velvet w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="font-label text-[11px] uppercase tracking-widest text-smoke/60">
                  <th className="px-3 py-2">{t('Datum', 'Date')}</th>
                  <th className="px-3 py-2">{t('Naam', 'Name')}</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">{t('Bedrag', 'Amount')}</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-t border-grape/20 align-top">
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
                    <td className="whitespace-nowrap px-3 py-2">
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
                          disabled={busy === o.id}
                          onClick={() => {
                            if (window.confirm(t('Deze pending bestelling annuleren?', 'Cancel this pending order?'))) {
                              void run(o.id, () => api.adminCancelOrder(o.id), load)
                            }
                          }}
                        >
                          {t('Annuleren', 'Cancel')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-smoke/60">
              {t(
                'Terugbetalen doe je in het Mollie-dashboard; de site verwerkt dat automatisch.',
                'Refunds happen in the Mollie dashboard; the site processes them automatically.',
              )}
            </p>
          </TableSection>
        </>
      )}

      {/* ------------------------------------------------ Plekken */}
      {tab === 'plekken' && data && (
        <TableSection title={`${t('Plekken', 'Seats')} (${data.seats.length})`} exportType="seats">
          <table className="card-velvet w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="font-label text-[11px] uppercase tracking-widest text-smoke/60">
                <th className="px-3 py-2">{t('Plek', 'Seat')}</th>
                <th className="px-3 py-2">Nickname</th>
                <th className="px-3 py-2">{t('Koper', 'Buyer')}</th>
                <th className="px-3 py-2">{t('Actie', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {data.seats.map((s) => (
                <tr key={s.seatId} className="border-t border-grape/20">
                  <td className="px-3 py-2 font-label text-bulb">#{seatNo(s.seatId)}</td>
                  <td className="px-3 py-2 text-milk">{s.nickname}</td>
                  <td className="px-3 py-2 text-smoke/70">
                    {s.name} · {s.email}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-1 text-xs"
                      disabled={busy === s.seatId}
                      onClick={() => void run(s.seatId, () => api.adminReleaseSeat(s.seatId), load)}
                    >
                      {t('Vrijgeven', 'Release')}
                    </button>
                  </td>
                </tr>
              ))}
              {data.seats.length === 0 && (
                <EmptyRow cols={4}>{t('Nog niets geclaimd.', 'Nothing claimed yet.')}</EmptyRow>
              )}
            </tbody>
          </table>
        </TableSection>
      )}

      {/* ------------------------------------------------ Polo's */}
      {tab === 'polos' && data && (
        <TableSection title={`Polo's (${data.polos.length})`} exportType="polos">
          <table className="card-velvet w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="font-label text-[11px] uppercase tracking-widest text-smoke/60">
                <th className="px-3 py-2">{t('Aantal', 'Qty')}</th>
                <th className="px-3 py-2">{t('Maat', 'Size')}</th>
                <th className="px-3 py-2">{t('Opdruk', 'Print')}</th>
                <th className="px-3 py-2">{t('Koper', 'Buyer')}</th>
                <th className="px-3 py-2">{t('Actie', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {data.polos.map((p) => {
                const edit = poloEdits[p.itemId]
                return (
                  <tr key={p.itemId} className="border-t border-grape/20">
                    <td className="px-3 py-2 font-label text-bulb">{p.qty}×</td>
                    <td className="px-3 py-2">
                      {edit ? (
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
                      ) : (
                        <span className="font-label text-bulb">{p.size}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {edit ? (
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
                      ) : (
                        <span className="text-milk">"{p.customName}"</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-smoke/70">
                      {p.name} · {p.email}
                    </td>
                    <td className="px-3 py-2">
                      {edit ? (
                        <button
                          type="button"
                          className="btn-neon !px-3 !py-1 text-xs"
                          disabled={busy === String(p.itemId)}
                          onClick={() =>
                            void run(
                              String(p.itemId),
                              () =>
                                api.adminUpdatePolo({
                                  itemId: p.itemId,
                                  customName: edit.customName,
                                  size: edit.size,
                                }),
                              async () => {
                                setPoloEdits((prev) => {
                                  const next = { ...prev }
                                  delete next[p.itemId]
                                  return next
                                })
                                await load()
                              },
                            )
                          }
                        >
                          {t('Opslaan', 'Save')}
                        </button>
                      ) : (
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
                      )}
                    </td>
                  </tr>
                )
              })}
              {data.polos.length === 0 && (
                <EmptyRow cols={5}>{t('Nog geen polo besteld.', 'No polos ordered yet.')}</EmptyRow>
              )}
            </tbody>
          </table>
        </TableSection>
      )}

      {/* ------------------------------------------------ Grafieken */}
      {tab === 'grafieken' && stats && (
        <>
          <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('Omzet', 'Revenue')} value={euro(stats.totals.revenueCents)} />
            <StatCard label={t('Betaalde bestellingen', 'Paid orders')} value={String(stats.totals.paidOrders)} />
            <StatCard label={t('Plekken geclaimd', 'Seats claimed')} value={String(stats.totals.seatsClaimed)} />
            <StatCard label={t('Accounts', 'Accounts')} value={String(stats.totals.accounts)} />
          </section>
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <BarChart title={t('Omzet per dag', 'Revenue per day')} points={stats.omzet} money />
            <BarChart title={t('Betaalde bestellingen per dag', 'Paid orders per day')} points={stats.omzet} />
            <BarChart title={t('Plekken geclaimd per dag', 'Seats claimed per day')} points={stats.plekken} />
            <BarChart title={t('Laatst ingelogd per dag', 'Last sign-in per day')} points={stats.logins} />
            <BarChart title={t('Nieuwe accounts per dag', 'New accounts per day')} points={stats.accounts} />
          </section>
          <p className="mt-6 text-center text-xs text-smoke/60">
            {t(
              'Logins tellen per account alleen de laatste keer; accounts van voor de meting tellen bij hun laatste profielwijziging.',
              'Sign-ins count only the most recent one per account; accounts from before tracking count at their last profile change.',
            )}
          </p>
        </>
      )}

      {/* ------------------------------------------------ Gebruikers */}
      {tab === 'gebruikers' && (
        <>
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
                  disabled={!newAdmin.includes('@') || busy !== ''}
                  onClick={() =>
                    void run(
                      newAdmin,
                      () => api.adminUpdateUser({ email: newAdmin, role: 'admin' }),
                      async () => {
                        setNewAdmin('')
                        await loadUsers()
                      },
                    )
                  }
                >
                  {t('Maak admin', 'Make admin')}
                </button>
              </div>
            </div>
          </section>

          <TableSection title={`${t('Gebruikers', 'Users')} (${users?.length ?? 0})`}>
            <table className="card-velvet w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="font-label text-[11px] uppercase tracking-widest text-smoke/60">
                  <th className="px-3 py-2">{t('Rol', 'Role')}</th>
                  <th className="px-3 py-2">{t('Voornaam', 'First name')}</th>
                  <th className="px-3 py-2">{t('Achternaam', 'Last name')}</th>
                  <th className="px-3 py-2">Nickname</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">{t('Laatste login', 'Last sign-in')}</th>
                  <th className="px-3 py-2">{t('Oude e-mails', 'Old emails')}</th>
                  <th className="px-3 py-2">{t('Edities', 'Editions')}</th>
                  <th className="px-3 py-2">{t('Actie', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => {
                  const edit = userEdits[u.email]
                  return (
                    <tr key={u.email} className="border-t border-grape/20 align-top">
                      <td className="px-3 py-2">
                        <span
                          className={`font-label text-[10px] uppercase tracking-widest ${
                            u.role === 'admin' ? 'text-neon' : 'text-smoke/50'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      {edit ? (
                        <>
                          <td className="px-3 py-2">
                            <input
                              className="input !w-28 !py-1"
                              maxLength={40}
                              value={edit.firstName}
                              onChange={(e) =>
                                setUserEdits((prev) => ({ ...prev, [u.email]: { ...edit, firstName: e.target.value } }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input !w-32 !py-1"
                              maxLength={40}
                              value={edit.lastName}
                              onChange={(e) =>
                                setUserEdits((prev) => ({ ...prev, [u.email]: { ...edit, lastName: e.target.value } }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input !w-32 !py-1"
                              maxLength={20}
                              value={edit.nickname}
                              onChange={(e) =>
                                setUserEdits((prev) => ({ ...prev, [u.email]: { ...edit, nickname: e.target.value } }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-smoke/70">{u.email}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-smoke/60">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('nl-NL') : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input !w-44 !py-1 text-xs"
                              placeholder={t('oud@adres.nl, ...', 'old@address.com, ...')}
                              value={edit.aliases}
                              onChange={(e) =>
                                setUserEdits((prev) => ({ ...prev, [u.email]: { ...edit, aliases: e.target.value } }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              {EDITIE_JAREN.map((year) => (
                                <label key={year} className="flex items-center gap-1.5 text-xs text-smoke">
                                  <input
                                    type="checkbox"
                                    checked={edit.editions.includes(year)}
                                    onChange={(e) =>
                                      setUserEdits((prev) => ({
                                        ...prev,
                                        [u.email]: {
                                          ...edit,
                                          editions: e.target.checked
                                            ? [...edit.editions, year]
                                            : edit.editions.filter((y) => y !== year),
                                        },
                                      }))
                                    }
                                  />
                                  {year}
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="btn-neon !px-3 !py-1 text-xs"
                              disabled={busy === u.email}
                              onClick={() =>
                                void run(
                                  u.email,
                                  () =>
                                    api.adminUpdateUser({
                                      email: u.email,
                                      firstName: edit.firstName,
                                      lastName: edit.lastName,
                                      nickname: edit.nickname,
                                      editions: edit.editions,
                                      aliases: edit.aliases.split(/[\s,;]+/).filter(Boolean),
                                    }),
                                  async () => {
                                    setUserEdits((prev) => {
                                      const next = { ...prev }
                                      delete next[u.email]
                                      return next
                                    })
                                    await loadUsers()
                                  },
                                )
                              }
                            >
                              {t('Opslaan', 'Save')}
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-milk">{u.firstName ?? '-'}</td>
                          <td className="px-3 py-2 text-milk">{u.lastName ?? '-'}</td>
                          <td className="px-3 py-2 text-smoke/80">{u.nickname ?? '-'}</td>
                          <td className="px-3 py-2 text-smoke/70">{u.email}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-smoke/60">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('nl-NL') : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-smoke/60">
                            {(u.aliases ?? '').split(' ').filter(Boolean).join(', ') || '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-label text-xs text-bulb">
                            {u.editions ?? '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <button
                              type="button"
                              className="btn-ghost !px-3 !py-1 text-xs"
                              onClick={() =>
                                setUserEdits((prev) => ({
                                  ...prev,
                                  [u.email]: {
                                    firstName: u.firstName ?? '',
                                    lastName: u.lastName ?? '',
                                    nickname: u.nickname ?? '',
                                    editions: (u.editions ?? '')
                                      .split(' ')
                                      .map(Number)
                                      .filter(Boolean),
                                    aliases: (u.aliases ?? '').split(' ').filter(Boolean).join(', '),
                                  },
                                }))
                              }
                            >
                              {t('Wijzig', 'Edit')}
                            </button>
                            {u.email !== user.email && (
                              <>
                                <button
                                  type="button"
                                  className="btn-ghost ml-2 !px-3 !py-1 text-xs"
                                  disabled={busy === u.email}
                                  onClick={() => void setRoleToggle(u.email, u.role)}
                                >
                                  {u.role === 'admin' ? t('Rol afnemen', 'Remove admin') : t('Maak admin', 'Make admin')}
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost ml-2 !px-3 !py-1 text-xs !border-red-500/40 hover:!border-red-500"
                                  disabled={busy === u.email}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        t(
                                          `Account ${u.email} verwijderen? Bestellingen en deelname-historie blijven bewaard; bij een nieuwe login ontstaat het account opnieuw.`,
                                          `Delete account ${u.email}? Orders and attendance history are kept; a new login recreates the account.`,
                                        ),
                                      )
                                    ) {
                                      void run(u.email, () => api.adminDeleteUser(u.email), loadUsers)
                                    }
                                  }}
                                >
                                  {t('Verwijder', 'Delete')}
                                </button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
                {users !== null && users.length === 0 && (
                  <EmptyRow cols={9}>{t('Nog geen accounts.', 'No accounts yet.')}</EmptyRow>
                )}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-smoke/60">
              {t(
                'Kopers verschijnen hier automatisch na betaling; anderen zodra ze inloggen of registreren.',
                'Buyers appear here automatically after payment; others once they sign in or register.',
              )}
            </p>
          </TableSection>
        </>
      )}
    </div>
  )

  function setRoleToggle(email: string, role: 'user' | 'admin') {
    const next = role === 'admin' ? 'user' : 'admin'
    if (
      next === 'user' &&
      !window.confirm(t(`${email} de admin-rol afnemen?`, `Remove admin role from ${email}?`))
    ) {
      return
    }
    void run(email, () => api.adminUpdateUser({ email, role: next }), loadUsers)
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-velvet p-4">
      <p className="text-sm text-smoke">{label}</p>
      <p className="mt-1 text-xl font-bold text-milk">{value}</p>
    </div>
  )
}

/**
 * Simpele staafgrafiek in SVG, geen chart-library nodig. Dagen zonder data
 * worden opgevuld met 0 zodat het verloop klopt.
 */
function BarChart({ title, points, money }: { title: string; points: DayPoint[]; money?: boolean }) {
  const { t } = useLang()

  const filled: { day: string; value: number }[] = []
  if (points.length > 0) {
    const byDay = new Map(points.map((p) => [p.day, money ? (p.cents ?? 0) : p.n]))
    const end = new Date(`${points[points.length - 1].day}T00:00:00Z`)
    for (const d = new Date(`${points[0].day}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      filled.push({ day: key, value: byDay.get(key) ?? 0 })
    }
  }

  const max = Math.max(1, ...filled.map((f) => f.value))
  const labelStep = Math.max(1, Math.ceil(filled.length / 10))
  const fmt = (v: number) => (money ? euro(v) : String(v))
  const BAR = 44
  const width = filled.length * BAR + 8

  return (
    <div className="card-velvet p-4">
      <h3 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">{title}</h3>
      {filled.length === 0 ? (
        <p className="mt-4 text-sm text-smoke/60">{t('Nog geen data.', 'No data yet.')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${width} 168`} className="h-42" style={{ minWidth: Math.min(width, 560) }}>
            {filled.map((f, i) => {
              const h = Math.round((f.value / max) * 108)
              const x = 4 + i * BAR
              return (
                <g key={f.day}>
                  <rect
                    x={x + 4}
                    y={132 - h}
                    width={BAR - 8}
                    height={Math.max(h, 2)}
                    rx={3}
                    fill="var(--color-neon)"
                    opacity={f.value === 0 ? 0.25 : 0.9}
                  />
                  {f.value > 0 && (
                    <text
                      x={x + BAR / 2}
                      y={124 - h}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-milk)"
                    >
                      {fmt(f.value)}
                    </text>
                  )}
                  {i % labelStep === 0 && (
                    <text
                      x={x + BAR / 2}
                      y={150}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--color-smoke)"
                      opacity={0.7}
                    >
                      {`${f.day.slice(8, 10)}/${f.day.slice(5, 7)}`}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

function TableSection({
  title,
  exportType,
  children,
}: {
  title: string
  exportType?: string
  children: ReactNode
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-label text-xs uppercase tracking-[0.25em] text-bulb">{title}</h2>
        {exportType && (
          <a href={`/api/admin/export?type=${exportType}`} className="btn-ghost !px-3 !py-1 text-xs">
            Export CSV
          </a>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  )
}

function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-2 text-smoke/60">
        {children}
      </td>
    </tr>
  )
}

function Wrap({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-lg px-6 py-24 text-center text-smoke">{children}</div>
}
