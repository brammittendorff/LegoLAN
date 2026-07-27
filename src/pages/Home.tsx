import { Link } from 'react-router-dom'
import { THEME, useCopy } from '../theme'
import { useLang } from '../lib/i18n'
import MarqueeStrip from '../components/MarqueeStrip'
import NewsletterForm from '../components/NewsletterForm'
import PoleMinifig from '../components/PoleMinifig'

export default function Home() {
  const { t } = useLang()
  const c = useCopy()

  const clubFeatures = [
    {
      eyebrow: 'Main Stage',
      title: t('Toernooien', 'Tournaments'),
      text: t(
        'Competitief en casual, met echte prijzen en onechte rivaliteit. Iedereen mag één keer op het podium.',
        'Competitive and casual, with real prizes and fake rivalry. Everyone gets one turn on stage.',
      ),
    },
    {
      eyebrow: 'VIP Room',
      title: t('De chillhoek', 'The chill corner'),
      text: t(
        'Consoles, bordspellen en een bank die al te veel heeft gezien. Champagne? Wij schenken bier.',
        'Consoles, board games and a couch that has seen too much. Champagne? We pour beer.',
      ),
    },
    {
      eyebrow: t('De Bar', 'The Bar'),
      title: t('Eten & drinken', 'Food & drinks'),
      text: t(
        'Koud bier, warme pizza en op zaterdagavond het Luxe Diner. De paal is van de netwerkkabels, beloofd.',
        'Cold beer, hot pizza and the Deluxe Dinner on Saturday night. The pole belongs to the network cables, promise.',
      ),
    },
  ]

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="bulb-row bulb-chase" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
          <p className="font-label text-xs tracking-[0.35em] neon-text-gold md:text-sm">
            {c.tagline}
          </p>

          <h1
            className="mt-8 font-display text-[13vw] leading-none neon-text md:text-8xl"
            aria-label={THEME.name}
          >
            {[...THEME.name].map((ch, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`inline-block ${i === 4 ? 'flicker-fault' : 'flicker'}`}
                style={{ animationDelay: `${i * 0.9}s` }}
              >
                {ch}
              </span>
            ))}
          </h1>
          <p className="neon-script -mt-1 rotate-[-4deg] text-6xl md:text-8xl">{THEME.scriptWord}</p>

          <p className="mx-auto mt-10 max-w-xl text-lg text-smoke">{c.hero.sub}</p>
          <p className="mt-4 font-label text-xs tracking-[0.2em] text-smoke/70">
            {c.date} · {c.location}
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/shop" className="btn-neon">
              {c.hero.ctaPrimary}
            </Link>
            <a href="#over" className="btn-ghost">
              {c.hero.ctaSecondary}
            </a>
          </div>
        </div>
        <PoleMinifig className="absolute -right-2 bottom-0 hidden h-56 text-neon/25 lg:block" />
        <PoleMinifig className="absolute -left-2 bottom-0 hidden h-56 -scale-x-100 text-grape/20 lg:block" />
        <div className="bulb-row bulb-chase" aria-hidden="true" />
      </section>

      <MarqueeStrip />

      <section id="over" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
        <h2 className="text-center">
          <span className="block font-label text-xs uppercase tracking-[0.3em] text-bulb">
            {t('Voor de nieuwelingen', 'For the newcomers')}
          </span>
          <span className="neon-script mt-2 block text-5xl md:text-6xl">
            {t('wat is LEGOLAN?', 'what is LEGOLAN?')}
          </span>
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-center text-smoke">
          {t(
            'Eén weekend per jaar verandert een doodnormale zaal in de meest besproken club van ' +
              "Nederland: tafels vol PC's, een netwerk dat sneller is dan je excuses, en een groep " +
              'vrienden die van vrijdag tot zondag gamet, eet, drinkt en veel te weinig slaapt. Georganiseerd ' +
              'door vrijwilligers die dit al jaren doen - van Netgamez tot Campzone tot hun eigen zaal.',
            'One weekend a year, a perfectly normal hall turns into the most talked-about club in ' +
              'the Netherlands: tables full of PCs, a network faster than your excuses, and a group ' +
              'of friends gaming, eating, drinking and seriously undersleeping from Friday to Sunday. ' +
              'Organised by volunteers who have been doing this for years - from Netgamez to Campzone to their own hall.',
          )}
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {clubFeatures.map((f) => (
            <div key={f.eyebrow} className="card-velvet p-6">
              <p className="font-label text-[11px] uppercase tracking-[0.3em] text-bulb">
                {f.eyebrow}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-milk">{f.title}</h3>
              <p className="mt-2 text-sm text-smoke/80">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center">
          <span className="block font-label text-xs uppercase tracking-[0.3em] text-bulb">
            {t('Onder voorbehoud, boven verwachting', 'Subject to change, beyond expectations')}
          </span>
          <span className="neon-script mt-2 block text-5xl md:text-6xl">
            {t('het programma', 'the program')}
          </span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.program.map((p) => (
            <div key={p.title} className="card-velvet p-5">
              <h3 className="font-semibold text-milk">{p.title}</h3>
              <p className="mt-2 text-sm text-smoke/80">{p.text}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-bulb">{c.buildup}</p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="neon-box bg-velvet/60 p-8 text-center md:p-12">
          <p className="font-label text-[11px] uppercase tracking-[0.3em] text-grape">
            {t('Vorig jaar', 'Last year')}
          </p>
          <h2 className="mt-3 text-2xl font-bold text-milk">{c.recap.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-smoke/85">{c.recap.text}</p>
          <Link to="/shop" className="btn-neon mt-8">
            {t('Zeker weten dat je erbij bent', 'Make sure you are in')}
          </Link>
        </div>
      </section>

      <section id="nieuwsbrief" className="border-t border-velvet-2 bg-velvet/40 px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-bold text-milk">{t('Blijf op de hoogte', 'Stay in the loop')}</h2>
          <p className="mt-2 text-sm text-smoke/80">
            {t(
              'Datum, thema-onthullingen en wanneer de kaartverkoop start. In een neutrale envelop.',
              'Dates, theme reveals and when ticket sales start. Delivered in a plain envelope.',
            )}
          </p>
          <div className="mt-8">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  )
}
