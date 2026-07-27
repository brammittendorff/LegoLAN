import { Link } from 'react-router-dom'
import { useLang } from '../lib/i18n'

export default function NotFound() {
  const { t } = useLang()
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="font-display text-6xl neon-text flicker">404</p>
      <h1 className="mt-6 text-xl font-bold text-milk">
        {t('Deze kamer is privé.', 'This room is private.')}
      </h1>
      <p className="mt-2 text-smoke/80">
        {t(
          'Wat je ook zocht, het is hier niet. Terug naar de zaal jij.',
          'Whatever you were looking for, it is not here. Back to the hall with you.',
        )}
      </p>
      <Link to="/" className="btn-neon mt-8">
        {t('Naar de ingang', 'To the entrance')}
      </Link>
    </div>
  )
}
