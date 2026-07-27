import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { useLang } from '../lib/i18n'
import { THEME } from '../theme'

export default function Nav() {
  const { count, setDrawerOpen } = useCart()
  const { user } = useAuth()
  const { lang, setLang, t } = useLang()

  const links = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/zaal', label: t('De Zaal', 'The Hall') },
    { to: '/fotos', label: t("Foto's", 'Photos') },
    { to: '/contact', label: 'Contact' },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Backstage' }] : []),
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-velvet-2 bg-void/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6">
        <Link to="/" className="font-display text-lg neon-text sm:text-xl" aria-label={`${THEME.name} home`}>
          {THEME.name}
        </Link>

        {/* Op mobiel een eigen rij onder logo + knoppen; op desktop één regel */}
        <nav
          className="order-3 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:order-none sm:w-auto sm:gap-6"
          aria-label={t('Hoofdmenu', 'Main menu')}
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap font-label text-[11px] uppercase tracking-[0.2em] transition-colors sm:text-xs ${
                  isActive ? 'text-neon' : 'text-smoke hover:text-milk'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `max-w-28 truncate rounded-full border px-3 py-1.5 font-label text-[11px] uppercase tracking-widest transition-colors ${
                isActive ? 'border-neon text-neon' : 'border-smoke/30 text-smoke hover:border-neon hover:text-milk'
              }`
            }
          >
            {user ? user.nickname || user.firstName || t('Account', 'Account') : t('Inloggen', 'Sign in')}
          </NavLink>
          <button
            type="button"
            onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
            className="rounded-full border border-smoke/30 px-2.5 py-1.5 font-label text-[11px] uppercase tracking-widest text-smoke transition-colors hover:border-neon hover:text-milk"
            aria-label={t('Switch to English', 'Schakel naar Nederlands')}
          >
            {lang === 'nl' ? 'EN' : 'NL'}
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-full border border-neon/60 px-3 py-1.5 font-label text-[11px] uppercase tracking-widest text-neon-soft transition-shadow hover:shadow-[0_0_14px_rgb(255_46_136/0.5)] sm:text-xs"
          >
            {t('Mandje', 'Cart')}
            {count > 0 ? ` · ${count}` : ''}
          </button>
        </div>
      </div>
    </header>
  )
}
