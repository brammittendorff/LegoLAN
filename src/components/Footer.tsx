import { useLang } from '../lib/i18n'
import { THEME, useCopy } from '../theme'

export default function Footer() {
  const { t } = useLang()
  const c = useCopy()

  const socials = [
    { label: 'Facebook', href: THEME.socials.facebook },
    { label: 'X (Twitter)', href: THEME.socials.x },
  ]

  return (
    <footer className="mt-20 border-t border-velvet-2">
      <div className="bulb-row bulb-chase" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg neon-text">{THEME.name}</p>
          <p className="mt-3 text-sm text-smoke/80">
            {t(
              'Eén keer per jaar, door vrijwilligers, met liefde en veel te lange netwerkkabels.',
              'Once a year, run by volunteers, with love and network cables that are way too long.',
            )}
          </p>
          <p className="mt-3 font-label text-xs text-smoke/60">
            {c.date} · {c.address}
          </p>
        </div>

        <div>
          <p className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
            {t('Vind ons', 'Find us')}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-smoke transition-colors hover:text-neon"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-label text-xs uppercase tracking-[0.25em] text-bulb">
            {t('Kleine lettertjes', 'The fine print')}
          </p>
          <p className="mt-3 text-sm text-smoke/70">{c.smallPrint}</p>
          <p className="mt-3 text-xs text-smoke/50">
            © {THEME.year} {THEME.name} · {c.edition}
          </p>
        </div>
      </div>
    </footer>
  )
}
