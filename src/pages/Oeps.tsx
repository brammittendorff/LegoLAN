import { Link } from 'react-router-dom'
import { useLang } from '../lib/i18n'

export default function Oeps() {
  const { t } = useLang()
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="neon-script text-6xl">{t('oeps...', 'oops...')}</h1>
      <p className="mt-6 text-smoke/80">
        {t(
          'Daar ging iets mis. Niet jouw schuld (waarschijnlijk). Er is niets afgeschreven - probeer het gewoon nog een keer.',
          'Something went wrong there. Not your fault (probably). Nothing was charged - just try again.',
        )}
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link to="/shop" className="btn-neon">
          {t('Naar de shop', 'To the shop')}
        </Link>
        <Link to="/contact" className="btn-ghost">
          {t('Hulp nodig?', 'Need help?')}
        </Link>
      </div>
    </div>
  )
}
