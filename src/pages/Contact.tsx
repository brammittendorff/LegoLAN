import { useState, type FormEvent } from 'react'
import { THEME, useCopy } from '../theme'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import Turnstile from '../components/Turnstile'

export default function Contact() {
  const { t } = useLang()
  const c = useCopy()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('busy')
    try {
      await api.contact({ name, email, message, turnstileToken: token })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Er ging iets mis.', 'Something went wrong.'))
      setStatus('error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="text-center">
        <h1 className="neon-script text-6xl md:text-7xl">contact</h1>
        <p className="mt-4 text-smoke/80">
          {t(
            'Stuur een berichtje. We bijten niet, tenzij je erom vraagt.',
            'Drop us a message. We do not bite, unless you ask nicely.',
          )}
        </p>
      </header>

      {status === 'done' ? (
        <div className="mt-12 text-center">
          <p className="neon-script text-4xl">{t('bericht ontvangen', 'message received')}</p>
          <p className="mt-4 text-smoke/80">
            {t('We nemen contact op. Discreet, uiteraard.', 'We will get in touch. Discreetly, of course.')}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 space-y-4">
          <div>
            <label htmlFor="c-naam" className="mb-1 block text-sm text-smoke">
              {t('Naam', 'Name')}
            </label>
            <input
              id="c-naam"
              required
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="c-email" className="mb-1 block text-sm text-smoke">
              {t('E-mail', 'Email')}
            </label>
            <input
              id="c-email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="c-bericht" className="mb-1 block text-sm text-smoke">
              {t('Bericht', 'Message')}
            </label>
            <textarea
              id="c-bericht"
              required
              minLength={10}
              rows={5}
              className="input resize-y"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Turnstile onToken={setToken} />
          {status === 'error' && <p className="text-sm text-neon-soft">{error}</p>}
          <button type="submit" className="btn-neon w-full" disabled={status === 'busy' || !token}>
            {status === 'busy' ? t('Momentje...', 'One moment...') : t('Versturen', 'Send')}
          </button>
        </form>
      )}

      <div className="mt-16 text-center">
        <p className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
          {t('De club zelf', 'The club itself')}
        </p>
        <p className="mt-3 text-sm text-smoke">
          {c.address} · {c.date}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-smoke/70">{c.buildup}</p>

        <p className="mt-10 font-label text-xs uppercase tracking-[0.25em] text-bulb">
          {t('Of vind ons hier', 'Or find us here')}
        </p>
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <a href={THEME.socials.facebook} target="_blank" rel="noreferrer" className="text-smoke hover:text-neon">
            Facebook
          </a>
          <a href={THEME.socials.x} target="_blank" rel="noreferrer" className="text-smoke hover:text-neon">
            X (Twitter)
          </a>
        </div>
      </div>
    </div>
  )
}
