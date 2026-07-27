import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import Turnstile from './Turnstile'

/**
 * Magic-link inloggen in twee stappen: e-mail invullen; kennen we je niet,
 * dan klapt het formulier uit tot registratie (voornaam/achternaam/nickname).
 */
export default function LoginForm({ next }: { next: string }) {
  const { t } = useLang()
  const [step, setStep] = useState<'email' | 'register' | 'sent'>('email')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [token, setToken] = useState('')
  // Turnstile-tokens zijn eenmalig; na de eerste check moet er een verse komen.
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const freshTurnstile = () => {
    setToken('')
    setTurnstileKey((k) => k + 1)
  }

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { status } = await api.authLogin({ email, turnstileToken: token, next })
      if (status === 'sent') {
        setStep('sent')
      } else {
        setStep('register')
        freshTurnstile()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Er ging iets mis.', 'Something went wrong.'))
      freshTurnstile()
    } finally {
      setBusy(false)
    }
  }

  const submitRegister = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.authRegister({ email, firstName, lastName, nickname, turnstileToken: token, next })
      setStep('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Er ging iets mis.', 'Something went wrong.'))
      freshTurnstile()
    } finally {
      setBusy(false)
    }
  }

  if (step === 'sent') {
    return (
      <div className="text-center">
        <p className="neon-script text-4xl">{t('check je mail', 'check your inbox')}</p>
        <p className="mx-auto mt-4 max-w-md text-sm text-smoke/80">
          {t(
            'Er ligt een inloglink in je inbox. 15 minuten geldig; daarna vraag je hier gewoon een nieuwe aan.',
            'A sign-in link is waiting in your inbox. Valid for 15 minutes; after that just request a new one here.',
          )}
        </p>
      </div>
    )
  }

  if (step === 'register') {
    return (
      <div className="card-velvet p-6">
        <p className="text-sm text-smoke">
          {t(
            `Nieuw hier? Leuk! Maak een account voor ${email} - daarna krijg je meteen je inloglink.`,
            `New here? Nice! Create an account for ${email} - your sign-in link follows right away.`,
          )}
        </p>
        <form onSubmit={submitRegister} className="mt-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              minLength={2}
              maxLength={40}
              className="input"
              placeholder={t('Voornaam', 'First name')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              aria-label={t('Voornaam', 'First name')}
            />
            <input
              required
              minLength={2}
              maxLength={40}
              className="input"
              placeholder={t('Achternaam', 'Last name')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              aria-label={t('Achternaam', 'Last name')}
            />
          </div>
          <input
            required
            minLength={2}
            maxLength={20}
            className="input"
            placeholder={t('Nickname (voor op de plattegrond)', 'Nickname (for the floor plan)')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            aria-label="Nickname"
          />
          <Turnstile key={turnstileKey} onToken={setToken} />
          {error && <p className="text-sm text-neon-soft">{error}</p>}
          <button type="submit" className="btn-neon" disabled={busy || !token}>
            {busy
              ? t('Momentje...', 'One moment...')
              : t('Registreer & stuur inloglink', 'Register & send sign-in link')}
          </button>
          <button
            type="button"
            className="text-xs text-smoke/60 hover:text-neon"
            onClick={() => {
              setStep('email')
              freshTurnstile()
            }}
          >
            {t('Ander e-mailadres gebruiken', 'Use a different email address')}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="card-velvet p-6">
      <p className="text-sm text-smoke">
        {t(
          'Vul je e-mailadres in. Ticket gekocht of erbij geweest? Dan krijg je direct een inloglink. Nieuw? Dan maken we een account voor je aan.',
          'Enter your email address. Bought a ticket or been to an edition? You get a sign-in link right away. New? We will set up an account for you.',
        )}
      </p>
      <form onSubmit={submitEmail} className="mt-4 flex flex-col gap-3">
        <input
          type="email"
          required
          className="input"
          placeholder={t('jouw@mailadres.nl', 'you@example.com')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          aria-label={t('E-mailadres', 'Email address')}
        />
        <Turnstile key={turnstileKey} onToken={setToken} />
        {error && <p className="text-sm text-neon-soft">{error}</p>}
        <button type="submit" className="btn-neon" disabled={busy || !token}>
          {busy ? t('Momentje...', 'One moment...') : t('Verder', 'Continue')}
        </button>
      </form>
    </div>
  )
}
