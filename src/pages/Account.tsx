import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLang } from '../lib/i18n'
import LoginForm from '../components/LoginForm'

export default function Account() {
  const { t } = useLang()
  const { user, loading, refresh, logout } = useAuth()
  const [params] = useSearchParams()
  const badLink = params.get('fout') === 'link'

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  // Vers profiel bij het openen van de pagina (plek geclaimd? meteen zichtbaar)
  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName)
      setLastName(user.lastName)
      setNickname(user.nickname)
    }
  }, [user])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('busy')
    setError('')
    try {
      await api.updateMe({ firstName, lastName, nickname })
      await refresh()
      setStatus('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Er ging iets mis.', 'Something went wrong.'))
      setStatus('error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="text-center">
        <h1 className="neon-script text-6xl md:text-7xl">
          {t('jouw account', 'your account')}
        </h1>
        <p className="mt-4 text-smoke/80">
          {t(
            'Geen wachtwoorden, wel een eigen plekje in de club.',
            'No passwords, but your own spot in the club.',
          )}
        </p>
      </header>

      {loading && <p className="mt-16 text-center text-smoke/70">{t('Laden...', 'Loading...')}</p>}

      {!loading && !user && (
        <div className="mx-auto mt-12 max-w-md">
          {badLink && (
            <p className="mb-6 text-center text-sm text-neon-soft">
              {t(
                'Die inloglink is verlopen of niet geldig. Vraag hieronder een nieuwe aan.',
                'That sign-in link is expired or invalid. Request a new one below.',
              )}
            </p>
          )}
          <LoginForm next="/account" />
        </div>
      )}

      {!loading && user && (
        <div className="mt-12">
          <div className="card-velvet p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-smoke/70">
                {t('Ingelogd als', 'Signed in as')} <span className="text-milk">{user.email}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="btn-ghost !px-4 !py-1.5 text-xs"
                >
                  {t('Uitloggen', 'Sign out')}
                </button>
                <button
                  type="button"
                  title={t(
                    'Maakt ook alle eerder gemailde inloglinks en sessies op andere apparaten ongeldig.',
                    'Also invalidates all previously emailed sign-in links and sessions on other devices.',
                  )}
                  onClick={async () => {
                    await api.authLogout(true).catch(() => undefined)
                    window.location.reload()
                  }}
                  className="btn-ghost !px-4 !py-1.5 text-xs"
                >
                  {t('Overal uitloggen + links resetten', 'Sign out everywhere + reset links')}
                </button>
              </div>
            </div>

            {user.editions.length > 0 && (
              <p className="mt-4 text-sm text-smoke">
                {t('Jij was erbij in:', 'You were there in:')}{' '}
                <span className="font-label text-bulb">{user.editions.join(' · ')}</span>
                {' - '}
                <Link to="/fotos" className="text-neon hover:underline">
                  {t("bekijk je foto's", 'view your photos')}
                </Link>
              </p>
            )}

            <p className="mt-2 text-sm text-smoke">
              {user.seats.length > 0 ? (
                <>
                  {t('Jouw plek in de zaal:', 'Your seat in the hall:')}{' '}
                  <span className="font-label text-bulb">
                    {user.seats.map((s) => `${s.edition}: #${s.seatNo} (${s.nickname})`).join(' · ')}
                  </span>
                  {' - '}
                  <Link to="/zaal" className="text-neon hover:underline">
                    {t('bekijk de plattegrond', 'view the floor plan')}
                  </Link>
                </>
              ) : (
                <>
                  {t('Nog geen plek in de zaal geclaimd.', 'No seat in the hall claimed yet.')}{' '}
                  <Link to="/zaal" className="text-neon hover:underline">
                    {t('Naar de plattegrond', 'To the floor plan')}
                  </Link>
                </>
              )}
            </p>

            <form onSubmit={save} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="a-voornaam" className="mb-1 block text-sm text-smoke">
                    {t('Voornaam', 'First name')}
                  </label>
                  <input
                    id="a-voornaam"
                    className="input"
                    maxLength={40}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="a-achternaam" className="mb-1 block text-sm text-smoke">
                    {t('Achternaam', 'Last name')}
                  </label>
                  <input
                    id="a-achternaam"
                    className="input"
                    maxLength={40}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="a-nickname" className="mb-1 block text-sm text-smoke">
                  {t('Nickname (op de plattegrond en je polo)', 'Nickname (on the floor plan and your polo)')}
                </label>
                <input
                  id="a-nickname"
                  className="input"
                  maxLength={20}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              {status === 'error' && <p className="text-sm text-neon-soft">{error}</p>}
              {status === 'saved' && (
                <p className="text-sm text-bulb">{t('Opgeslagen.', 'Saved.')}</p>
              )}

              <button type="submit" className="btn-neon" disabled={status === 'busy'}>
                {status === 'busy' ? t('Momentje...', 'One moment...') : t('Opslaan', 'Save')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
