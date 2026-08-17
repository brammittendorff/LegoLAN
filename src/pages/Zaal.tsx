import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EDITION_YEAR } from '../../shared/products'
import { buildRoom, type Cell } from '../../shared/seatmap'
import { api, type SeatClaim } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLang } from '../lib/i18n'
import LoginForm from '../components/LoginForm'

type ClaimOrder = {
  id: string
  seatQuota: number
  seatsClaimed: SeatClaim[]
}

/** Een plek die je zelf mag bijwerken. `orderId` ontbreekt bij een plek die aan jou gekoppeld is. */
type MySeat = {
  orderId: string | undefined
  seatId: string
  nickname: string
  ownerEmail: string | null
  seatNo: number
  /** Uit je eigen bestelling (dan mag je ook het e-mailadres zetten) */
  mine: boolean
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
  // Naam en e-mail in bewerking per geclaimde plek; ontbreekt de sleutel, dan
  // staat het veld zoals het in de database staat.
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({})
  // Adres van wie op de plek komt die je nu kiest (optioneel)
  const [claimEmail, setClaimEmail] = useState('')
  const [busySeat, setBusySeat] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const { user, loading: authLoading, refresh } = useAuth()

  // Ingelogd? Dan vullen we je nickname alvast in, maar alleen zolang je zelf
  // niets hebt getypt of geclaimd: /api/me leidt je nickname ook af uit een
  // geclaimde plek, en die naam hoort niet in het veld voor de volgende plek.
  const nickTouched = useRef(false)
  useEffect(() => {
    if (nickTouched.current || !user?.nickname) return
    setNickname((prev) => prev || user.nickname)
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

  const seatNos = useMemo(
    () => new Map(room.flat().flatMap((c) => (c.seatId ? [[c.seatId, c.seatNo ?? 0]] : []))),
    [room],
  )

  // Jouw eigen plekken, met naam en (voor de koper) het adres van wie er zit.
  // Plekken uit je bestelling beheer je volledig; een plek die iemand anders
  // aan jou koppelde kun je alleen een andere naam geven.
  const mySeats: MySeat[] = [
    ...orders.flatMap((o) =>
      o.seatsClaimed.map((s) => ({
        orderId: o.id,
        seatId: s.seatId,
        nickname: s.nickname,
        ownerEmail: s.ownerEmail,
        seatNo: seatNos.get(s.seatId) ?? 0,
        mine: true,
      })),
    ),
    ...(user?.seats ?? [])
      .filter(
        (s) =>
          s.edition === EDITION_YEAR &&
          !orders.some((o) => o.seatsClaimed.some((c) => c.seatId === s.seatId)),
      )
      .map((s) => ({
        orderId: undefined,
        seatId: s.seatId,
        nickname: s.nickname,
        ownerEmail: null,
        seatNo: s.seatNo,
        mine: false,
      })),
  ].sort((a, b) => a.seatNo - b.seatNo)

  // Link om door te sturen: wie hem heeft claimt de resterende plekken van deze
  // bestelling zelf (en zet zijn eigen naam erop).
  const shareOrderId = orders.find((o) => o.seatsClaimed.length < o.seatQuota)?.id
  const shareLink = shareOrderId
    ? `${window.location.origin}/zaal?order=${encodeURIComponent(shareOrderId)}`
    : ''

  const claim = async (cell: Cell) => {
    const target = orders.find((o) => o.seatsClaimed.length < o.seatQuota)
    if (!target || !cell.seatId) return
    const nick = nickname.trim()
    if (!nick) {
      setNotice(
        t(
          'Vul eerst de (gamer)naam in voor deze plek - anders weet niemand naast wie ze zitten.',
          'Fill in the (gamer) name for this seat first - otherwise nobody knows who they are sitting next to.',
        ),
      )
      return
    }
    nickTouched.current = true
    setBusySeat(cell.seatId)
    setNotice('')
    try {
      // Alleen de eerste keer onthouden: anders overschrijft de naam van een
      // vriend voor wie je claimt jouw eigen naam.
      if (!localStorage.getItem('legolan-nick')) localStorage.setItem('legolan-nick', nick)
    } catch {
      /* jammer dan */
    }
    const meer = remaining > 1
    const mail = claimEmail.trim().toLowerCase()
    try {
      const { invited } = await api.claimSeat({
        orderId: target.id,
        seatId: cell.seatId,
        nickname: nick,
        email: mail || undefined,
      })
      await Promise.all([refreshSeats(), loadOrders()])
      void refresh() // profiel bijwerken zodat /account de plek meteen toont
      setClaimEmail('')
      if (meer) {
        setNickname('') // volgende plek is vaak voor iemand anders
        setNotice(
          invited
            ? t(
                `Plek ${cell.seatNo} staat op naam van ${nick}, en ${mail} heeft een inloglink gekregen. Vul nu de volgende plek in.`,
                `Seat ${cell.seatNo} is in the name of ${nick}, and ${mail} received a sign-in link. Now fill in the next seat.`,
              )
            : t(
                `Plek ${cell.seatNo} staat op naam van ${nick}. Vul nu de naam voor de volgende plek in.`,
                `Seat ${cell.seatNo} is in the name of ${nick}. Now fill in the name for the next seat.`,
              ),
        )
      } else {
        setNotice(
          invited
            ? t(
                `Plek ${cell.seatNo} staat op naam van ${nick}; ${mail} heeft een inloglink gekregen om zijn naam zelf aan te passen.`,
                `Seat ${cell.seatNo} is in the name of ${nick}; ${mail} received a sign-in link to adjust the name.`,
              )
            : t(
                `Plek ${cell.seatNo} is van jou. Kom maar op met dat weekend.`,
                `Seat ${cell.seatNo} is yours. Bring on that weekend.`,
              ),
        )
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('Claimen mislukte.', 'Claiming failed.'))
      await refreshSeats().catch(() => undefined)
    } finally {
      setBusySeat(null)
    }
  }

  const saveSeat = async (seat: MySeat) => {
    const nick = (nameDrafts[seat.seatId] ?? seat.nickname).trim()
    if (nick.length < 2) {
      setNotice(
        t('Kies een naam van minstens 2 tekens.', 'Pick a name of at least 2 characters.'),
      )
      return
    }
    const draftMail = emailDrafts[seat.seatId]
    const mail = (draftMail ?? seat.ownerEmail ?? '').trim().toLowerCase()
    setBusySeat(seat.seatId)
    setNotice('')
    try {
      const { invited } = await api.updateSeat({
        orderId: seat.orderId,
        seatId: seat.seatId,
        nickname: nick,
        // Alleen meesturen als de koper het veld heeft aangeraakt; leeg = ontkoppelen.
        email: seat.mine && draftMail !== undefined ? mail : undefined,
      })
      setNameDrafts(({ [seat.seatId]: _naam, ...rest }) => rest)
      setEmailDrafts(({ [seat.seatId]: _mail, ...rest }) => rest)
      await Promise.all([refreshSeats(), loadOrders()])
      void refresh()
      setNotice(
        invited
          ? t(
              `Plek ${seat.seatNo} staat op naam van ${nick}; ${mail} heeft een inloglink gekregen.`,
              `Seat ${seat.seatNo} is in the name of ${nick}; ${mail} received a sign-in link.`,
            )
          : t(
              `Plek ${seat.seatNo} staat nu op naam van ${nick}.`,
              `Seat ${seat.seatNo} is now in the name of ${nick}.`,
            ),
      )
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('Opslaan mislukte.', 'Saving failed.'))
    } finally {
      setBusySeat(null)
    }
  }

  const release = async (seatId: string, seatNo: number) => {
    const ownerOrderId = seatOwner.get(seatId)
    if (!ownerOrderId) return
    if (
      !window.confirm(
        t(
          `Plek ${seatNo} vrijgeven? Je kunt daarna een andere plek kiezen.`,
          `Release seat ${seatNo}? You can pick a different seat afterwards.`,
        ),
      )
    ) {
      return
    }
    setBusySeat(seatId)
    setNotice('')
    try {
      await api.releaseSeat({ orderId: ownerOrderId, seatId })
      setNameDrafts(({ [seatId]: _weg, ...rest }) => rest)
      await Promise.all([refreshSeats(), loadOrders()])
      void refresh()
      setNotice(
        t(
          `Plek ${seatNo} is weer vrij. Kies een nieuwe plek.`,
          `Seat ${seatNo} is free again. Pick a new seat.`,
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
          onClick={() => {
            if (cell.seatId) void release(cell.seatId, cell.seatNo ?? 0)
          }}
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
                {remaining === 1
                  ? t(
                      'Vul de naam in en klik op een vrije plek.',
                      'Fill in the name and click a free seat.',
                    )
                  : t(
                      'Elke plek krijgt zijn eigen naam: vul de naam in voor de plek die je nu kiest, en daarna die voor de volgende.',
                      'Every seat gets its own name: fill in the name for the seat you pick now, then the one for the next.',
                    )}
              </p>
              <input
                className="input mx-auto mt-4 max-w-xs text-center"
                placeholder={
                  mySeats.length > 0
                    ? t('Naam voor de volgende plek', 'Name for the next seat')
                    : t('Je (gamer)naam', 'Your (gamer) name')
                }
                maxLength={20}
                value={nickname}
                onChange={(e) => {
                  nickTouched.current = true
                  setNickname(e.target.value)
                }}
                aria-label={t(
                  'Gamernaam voor de plek die je nu kiest',
                  'Gamer name for the seat you pick now',
                )}
              />
              <input
                type="email"
                className="input mx-auto mt-2 max-w-xs text-center"
                placeholder={t('E-mail van wie er zit (optie)', 'Email of who sits there (optional)')}
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
                aria-label={t(
                  'E-mailadres van wie op deze plek zit',
                  'Email address of who sits in this seat',
                )}
              />
              <p className="mx-auto mt-2 max-w-sm text-xs text-smoke/60">
                {t(
                  'Claim je voor iemand anders? Vul zijn e-mailadres in, dan krijgt hij een inloglink en past hij zijn eigen naam aan. Laat leeg voor je eigen plek.',
                  'Claiming for someone else? Fill in their email and they get a sign-in link to adjust their own name. Leave empty for your own seat.',
                )}
              </p>

              {shareOrderId && (
                <div className="mt-5 border-t border-grape/30 pt-4">
                  <p className="text-sm text-smoke/80">
                    {t(
                      'Laat hem liever zelf kiezen? Stuur deze link, dan pakt hij zijn eigen plek en naam.',
                      'Rather let them pick? Send this link and they choose their own seat and name.',
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                    <input
                      readOnly
                      className="input min-w-0 flex-1 text-xs"
                      value={shareLink}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={t('Deelbare link naar je plekken', 'Shareable link to your seats')}
                    />
                    <button
                      type="button"
                      className="btn-ghost !px-4 !py-1.5 text-xs"
                      onClick={() => {
                        void navigator.clipboard?.writeText(shareLink)
                        setNotice(t('Link gekopieerd.', 'Link copied.'))
                      }}
                    >
                      {t('Kopieer link', 'Copy link')}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-smoke/60">
                    {t(
                      'Wie deze link heeft kan de plekken van deze bestelling kiezen en wijzigen, dus stuur hem alleen naar je eigen groepje.',
                      'Anyone with this link can pick and change the seats of this order, so only send it to your own group.',
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {mySeats.length > 0 && (
            <section className="neon-box mx-auto mt-8 max-w-xl bg-velvet/70 p-6">
              <h2 className="text-center font-label text-xs uppercase tracking-[0.25em] text-bulb">
                {t('Jouw plekken', 'Your seats')}
              </h2>
              <p className="mt-2 text-center text-sm text-smoke/80">
                {t(
                  'Zet per plek de naam van wie er zit, en eventueel zijn e-mailadres. Met een adres erbij beheert hij zijn eigen naam en staat hij als zichzelf in onze lijst.',
                  'Set the name of whoever sits there per seat, and optionally their email. With an email they manage their own name and appear as themselves in our list.',
                )}
              </p>
              <ul className="mt-4 space-y-3">
                {mySeats.map((seat) => {
                  const draft = nameDrafts[seat.seatId] ?? seat.nickname
                  const mailDraft = emailDrafts[seat.seatId] ?? seat.ownerEmail ?? ''
                  const changed =
                    draft.trim() !== seat.nickname ||
                    mailDraft.trim().toLowerCase() !== (seat.ownerEmail ?? '')
                  return (
                    <li key={seat.seatId} className="flex flex-wrap items-center gap-2">
                      <span className="w-9 shrink-0 text-right font-label text-xs text-bulb">
                        #{seat.seatNo}
                      </span>
                      <input
                        className="input min-w-0 flex-1"
                        maxLength={20}
                        value={draft}
                        onChange={(e) =>
                          setNameDrafts((d) => ({ ...d, [seat.seatId]: e.target.value }))
                        }
                        aria-label={t(
                          `Naam op plek ${seat.seatNo}`,
                          `Name on seat ${seat.seatNo}`,
                        )}
                      />
                      {seat.mine && (
                        <input
                          type="email"
                          className="input min-w-0 flex-1"
                          placeholder={t('E-mail (optie)', 'Email (optional)')}
                          value={mailDraft}
                          onChange={(e) =>
                            setEmailDrafts((d) => ({ ...d, [seat.seatId]: e.target.value }))
                          }
                          aria-label={t(
                            `E-mailadres op plek ${seat.seatNo}`,
                            `Email address on seat ${seat.seatNo}`,
                          )}
                        />
                      )}
                      <button
                        type="button"
                        className="btn-neon !px-4 !py-1.5 text-xs"
                        disabled={!changed || busySeat !== null}
                        onClick={() => void saveSeat(seat)}
                      >
                        {busySeat === seat.seatId
                          ? t('Momentje...', 'One moment...')
                          : t('Opslaan', 'Save')}
                      </button>
                      {seat.mine && (
                        <button
                          type="button"
                          className="btn-ghost !px-4 !py-1.5 text-xs"
                          disabled={busySeat !== null}
                          onClick={() => void release(seat.seatId, seat.seatNo)}
                        >
                          {t('Vrijgeven', 'Release')}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
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
