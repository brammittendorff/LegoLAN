import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buildRoom, type Cell } from '../../shared/seatmap'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLang } from '../lib/i18n'
import LoginForm from '../components/LoginForm'

type ClaimOrder = {
  id: string
  seatQuota: number
  seatsClaimed: { seatId: string; nickname: string }[]
}

export default function Zaal() {
  const { t } = useLang()
  const room = useMemo(buildRoom, [])
  const cols = room[0]?.length ?? 0

  const legend = [
    { label: t('Vrije plek', 'Free seat'), cls: 'border border-grape/50 bg-velvet-2' },
    { label: t('Bezet', 'Taken'), cls: 'bg-neon' },
    { label: t('Bar', 'Bar'), cls: 'bg-grape/40' },
    { label: t('Deur', 'Door'), cls: 'bg-red-500/60' },
    { label: t('Switch', 'Switch'), cls: 'bg-blue-500/60' },
    { label: t('Chill / openhaard', 'Chill / fireplace'), cls: 'bg-bulb/40' },
  ]

  const [params] = useSearchParams()
  const paramOrder = params.get('order')

  const [claims, setClaims] = useState<Map<string, string>>(new Map())
  const [orders, setOrders] = useState<ClaimOrder[]>([])
  const [nickname, setNickname] = useState(() => {
    try {
      return localStorage.getItem('legolan-nick') ?? ''
    } catch {
      return ''
    }
  })
  const [busySeat, setBusySeat] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const { user, loading: authLoading, refresh } = useAuth()

  // Ingelogd? Dan vullen we je nickname alvast in.
  useEffect(() => {
    if (user?.nickname) {
      setNickname((prev) => prev || user.nickname)
    }
  }, [user])

  const refreshSeats = useCallback(async () => {
    const { seats } = await api.seats()
    setClaims(new Map(seats.map((s) => [s.seatId, s.nickname])))
  }, [])

  // Jouw bestellingen komen bij je sessie vandaan; de ?order=-link uit de
  // mail wordt daaraan toegevoegd (voor wie voor een ander claimt).
  const loadOrders = useCallback(async () => {
    const eigen = (await api.myOrders()).orders
    if (paramOrder && !eigen.some((o) => o.id === paramOrder)) {
      try {
        const extern = await api.order(paramOrder)
        if (extern.status === 'paid' && extern.seatQuota > 0) {
          eigen.push({
            id: paramOrder,
            seatQuota: extern.seatQuota,
            seatsClaimed: extern.seatsClaimed,
          })
        }
      } catch {
        /* onbekende of ongeldige link: negeren */
      }
    }
    setOrders(eigen)
  }, [paramOrder])

  useEffect(() => {
    if (!user) return
    refreshSeats().catch(() =>
      setNotice(
        t('Kon de plattegrond niet laden. Ververs de pagina.', 'Could not load the floor plan. Refresh the page.'),
      ),
    )
    loadOrders().catch(() => setOrders([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSeats, loadOrders, user])

  const remaining = orders.reduce((n, o) => n + (o.seatQuota - o.seatsClaimed.length), 0)
  const canClaim = remaining > 0
  const seatOwner = new Map(orders.flatMap((o) => o.seatsClaimed.map((s) => [s.seatId, o.id])))

  const claim = async (cell: Cell) => {
    const target = orders.find((o) => o.seatsClaimed.length < o.seatQuota)
    if (!target || !cell.seatId) return
    const nick = nickname.trim()
    if (!nick) {
      setNotice(
        t(
          'Vul eerst je (gamer)naam in - anders weet niemand naast wie ze zitten.',
          'Fill in your (gamer) name first - otherwise nobody knows who they are sitting next to.',
        ),
      )
      return
    }
    setBusySeat(cell.seatId)
    setNotice('')
    try {
      localStorage.setItem('legolan-nick', nick)
    } catch {
      /* jammer dan */
    }
    try {
      await api.claimSeat({ orderId: target.id, seatId: cell.seatId, nickname: nick })
      await Promise.all([refreshSeats(), loadOrders()])
      void refresh() // profiel bijwerken zodat /account de plek meteen toont
      setNotice(
        t(
          `Plek ${cell.seatNo} is van jou. Kom maar op met dat weekend.`,
          `Seat ${cell.seatNo} is yours. Bring on that weekend.`,
        ),
      )
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('Claimen mislukte.', 'Claiming failed.'))
      await refreshSeats().catch(() => undefined)
    } finally {
      setBusySeat(null)
    }
  }

  const release = async (cell: Cell) => {
    const ownerOrderId = cell.seatId ? seatOwner.get(cell.seatId) : undefined
    if (!ownerOrderId || !cell.seatId) return
    if (
      !window.confirm(
        t(
          `Plek ${cell.seatNo} vrijgeven? Je kunt daarna een andere plek kiezen.`,
          `Release seat ${cell.seatNo}? You can pick a different seat afterwards.`,
        ),
      )
    ) {
      return
    }
    setBusySeat(cell.seatId)
    setNotice('')
    try {
      await api.releaseSeat({ orderId: ownerOrderId, seatId: cell.seatId })
      await Promise.all([refreshSeats(), loadOrders()])
      void refresh()
      setNotice(
        t(
          `Plek ${cell.seatNo} is weer vrij. Kies een nieuwe plek.`,
          `Seat ${cell.seatNo} is free again. Pick a new seat.`,
        ),
      )
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('Vrijgeven mislukte.', 'Releasing failed.'))
    } finally {
      setBusySeat(null)
    }
  }

  const cellView = (cell: Cell) => {
    const key = `${cell.row}-${cell.col}`
    const base = 'flex aspect-square items-center justify-center rounded-[4px] font-label text-[10px]'

    if (cell.kind === 'void') return <div key={key} />
    if (cell.kind === 'floor') return <div key={key} className={`${base} bg-white/[0.04]`} />
    if (cell.kind === 'bar') return <div key={key} className={`${base} bg-grape/40`} title={t('Bar', 'Bar')} />
    if (cell.kind === 'door')
      return <div key={key} className={`${base} bg-red-500/60`} title={t('Deur', 'Door')} />
    if (cell.kind === 'switch')
      return <div key={key} className={`${base} bg-blue-500/60`} title={t('Netwerkswitch', 'Network switch')} />
    if (cell.kind === 'chill')
      return (
        <div key={key} className={`${base} bg-bulb/40`} title={t('Chillhoek / openhaard', 'Chill corner / fireplace')} />
      )

    // LAN-plek
    const taken = cell.seatId ? claims.get(cell.seatId) : undefined
    const mine = cell.seatId ? seatOwner.has(cell.seatId) : false

    if (taken && mine) {
      return (
        <button
          key={key}
          type="button"
          onClick={() => void release(cell)}
          title={t(
            `Jouw plek (${taken}) - klik om vrij te geven`,
            `Your seat (${taken}) - click to release`,
          )}
          className={`${base} cursor-pointer bg-bulb font-bold text-void shadow-[0_0_10px_rgb(255_201_107/0.8)] transition-shadow hover:shadow-[0_0_14px_rgb(255_46_136/0.8)]`}
        >
          {cell.seatNo}
        </button>
      )
    }
    if (taken) {
      return (
        <div
          key={key}
          className={`${base} bg-neon font-bold text-void`}
          title={`${t('Plek', 'Seat')} ${cell.seatNo}: ${taken}`}
        >
          {cell.seatNo}
        </div>
      )
    }

    return (
      <button
        key={key}
        type="button"
        disabled={!canClaim || busySeat !== null}
        onClick={() => void claim(cell)}
        title={`${t('Plek', 'Seat')} ${cell.seatNo} - ${t('vrij', 'free')}`}
        className={`${base} border border-grape/50 bg-velvet-2 text-smoke/80 ${
          canClaim
            ? 'cursor-pointer transition-shadow hover:border-neon hover:text-milk hover:shadow-[0_0_10px_rgb(255_46_136/0.6)]'
            : 'cursor-default'
        } ${busySeat === cell.seatId ? 'animate-pulse' : ''}`}
      >
        {cell.seatNo}
      </button>
    )
  }

  const claimedList = [...claims.entries()]
    .map(([seatId, nick]) => {
      const cell = room.flat().find((c) => c.seatId === seatId)
      return cell ? { no: cell.seatNo ?? 0, nick } : null
    })
    .filter((x): x is { no: number; nick: string } => x !== null)
    .sort((a, b) => a.no - b.no)

  const mySeatCount = seatOwner.size

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <header className="text-center">
        <h1 className="neon-script text-6xl md:text-7xl">{t('de zaal', 'the hall')}</h1>
        <p className="mt-4 text-smoke/80">
          {t(
            'Kies waar je het weekend doorbrengt. Naast je vrienden, of juist niet.',
            'Pick where you spend the weekend. Next to your friends, or deliberately not.',
          )}
        </p>
      </header>

      {authLoading && <p className="mt-16 text-center text-smoke/70">{t('Laden...', 'Loading...')}</p>}

      {!authLoading && !user && (
        <div className="mx-auto mt-12 max-w-md">
          <p className="mb-6 text-center text-sm text-smoke/80">
            {t(
              'De plattegrond is alleen voor bezoekers. Log in en je ziet wie waar zit.',
              'The floor plan is for attendees only. Sign in to see who sits where.',
            )}
          </p>
          <LoginForm next={paramOrder ? `/zaal?order=${paramOrder}` : '/zaal'} />
        </div>
      )}

      {user && (
        <>
          {canClaim && (
            <div className="neon-box mx-auto mt-10 max-w-xl bg-velvet/70 p-6 text-center">
              <p className="text-milk">
                {remaining === 1
                  ? t('Je hebt nog 1 plek te claimen.', 'You have 1 seat left to claim.')
                  : t(`Je hebt nog ${remaining} plekken te claimen.`, `You have ${remaining} seats left to claim.`)}{' '}
                {t('Vul je naam in en klik op een vrije plek.', 'Fill in your name and click a free seat.')}
              </p>
              <input
                className="input mx-auto mt-4 max-w-xs text-center"
                placeholder={t('Je (gamer)naam', 'Your (gamer) name')}
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                aria-label={t('Gamernaam voor op de plattegrond', 'Gamer name shown on the floor plan')}
              />
            </div>
          )}

          {!canClaim && mySeatCount > 0 && (
            <p className="mt-8 text-center text-smoke">
              {t(
                'Al je plekken zijn geclaimd (goud op de kaart). Verkeerd geklikt? Klik op je gouden plek om hem vrij te geven.',
                'All your seats are claimed (gold on the map). Picked wrong? Click your gold seat to release it.',
              )}
            </p>
          )}

          {orders.length === 0 && (
            <p className="mt-8 text-center text-sm text-smoke/70">
              {t(
                'Nog geen ticket voor deze editie? Dan eerst even langs',
                'No ticket for this edition yet? First swing by',
              )}{' '}
              <Link to="/shop" className="text-neon hover:underline">
                {t('de shop', 'the shop')}
              </Link>
              .{' '}
              {t(
                'Na het betalen kun je hier direct je plek kiezen.',
                'After paying you can pick your seat right here.',
              )}
            </p>
          )}

          {notice && <p className="mt-6 text-center text-sm text-bulb">{notice}</p>}

          <div className="mt-10 overflow-x-auto pb-2">
            <div
              className="mx-auto grid w-max gap-1"
              style={{ gridTemplateColumns: `repeat(${cols}, 2.1rem)` }}
            >
              {room.flat().map(cellView)}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-2 text-xs text-smoke/80">
                <span className={`inline-block h-3.5 w-3.5 rounded-[3px] ${l.cls}`} aria-hidden="true" />
                {l.label}
              </span>
            ))}
          </div>

          {claimedList.length > 0 && (
            <section className="mx-auto mt-14 max-w-3xl">
              <h2 className="text-center font-label text-xs uppercase tracking-[0.25em] text-bulb">
                {t('Wie zit waar', 'Who sits where')}
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {claimedList.map((claimed) => (
                  <li
                    key={claimed.no}
                    className="card-velvet flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="w-9 shrink-0 text-right font-label text-xs text-bulb">
                      #{claimed.no}
                    </span>
                    <span className="min-w-0 truncate text-milk">{claimed.nick}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
