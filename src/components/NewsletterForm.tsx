import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import Turnstile from './Turnstile'

export default function NewsletterForm() {
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('busy')
    try {
      await api.subscribe({ email, turnstileToken: token })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Er ging iets mis.', 'Something went wrong.'))
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <p className="neon-script text-3xl">
        {t('Je staat op de lijst. Discreet, beloofd.', 'You are on the list. Discreetly, promise.')}
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('jouw@mailadres.nl', 'you@example.com')}
          className="input flex-1"
          aria-label={t('E-mailadres', 'Email address')}
        />
        <button type="submit" className="btn-neon" disabled={status === 'busy' || !token}>
          {status === 'busy' ? t('Momentje...', 'One moment...') : t('Schrijf me in', 'Sign me up')}
        </button>
      </div>
      <Turnstile onToken={setToken} />
      {status === 'error' && <p className="text-sm text-neon-soft">{error}</p>}
    </form>
  )
}
