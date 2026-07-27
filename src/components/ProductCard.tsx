import { useState } from 'react'
import { daysKey, EVENT_DAYS, type EventDay, type Product } from '../../shared/products'
import { euro } from '../lib/money'
import { useCart } from '../lib/cart'
import { useLang } from '../lib/i18n'

const DAY_LABEL: Record<EventDay, { nl: string; en: string }> = {
  vr: { nl: 'vrijdag', en: 'Friday' },
  za: { nl: 'zaterdag', en: 'Saturday' },
  zo: { nl: 'zondag', en: 'Sunday' },
}

export default function ProductCard({
  product,
  remaining,
}: {
  product: Product
  remaining: number | null | undefined
}) {
  const { add } = useCart()
  const { t, pick, lang } = useLang()
  const [size, setSize] = useState<string | undefined>()
  const [customName, setCustomName] = useState('')
  const [days, setDays] = useState<EventDay[]>([])

  const toggleDay = (day: EventDay) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))

  const typeLabel = {
    ticket: 'Ticket',
    merch: 'Merch',
    extra: 'Extra',
  }[product.type]

  const soldOut = typeof remaining === 'number' && remaining <= 0
  const almostGone = typeof remaining === 'number' && remaining > 0 && remaining <= 10
  const needsSize = !!product.sizes && !size
  const needsName = !!product.needsCustomName && customName.trim().length < 2
  const needsDays = !!product.perDay && days.length === 0

  return (
    <article className="card-velvet flex flex-col gap-3 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-label text-[10px] uppercase tracking-[0.25em] text-grape">
          {typeLabel}
        </span>
        <span className="font-label text-sm text-bulb">
          {euro(product.priceCents)}
          {product.perDay ? t(' / dag', ' / day') : ''}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-milk">{pick(product.name)}</h3>
      <p className="flex-1 text-sm text-smoke/80">{pick(product.tagline)}</p>

      {product.perDay && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Dagen', 'Days')}>
            {EVENT_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={days.includes(day)}
                onClick={() => toggleDay(day)}
                className={`rounded-lg border px-3 py-1 font-label text-xs transition-colors ${
                  days.includes(day)
                    ? 'border-neon bg-neon font-bold text-void'
                    : 'border-grape/40 text-smoke hover:border-neon'
                }`}
              >
                {DAY_LABEL[day][lang]}
              </button>
            ))}
          </div>
          {days.length > 0 && (
            <p className="font-label text-xs text-smoke/80">
              {t('Totaal', 'Total')}: {euro(product.priceCents * days.length)}
            </p>
          )}
        </>
      )}

      {product.sizes && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Maat', 'Size')}>
          {product.sizes.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={size === s}
              onClick={() => setSize(s)}
              className={`rounded-lg border px-3 py-1 font-label text-xs transition-colors ${
                size === s
                  ? 'border-neon bg-neon font-bold text-void'
                  : 'border-grape/40 text-smoke hover:border-neon'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {soldOut && (
        <p className="font-label text-sm uppercase tracking-widest neon-text">
          {t('Uitverkocht', 'Sold out')}
        </p>
      )}
      {almostGone && (
        <p className="font-label text-xs text-bulb">
          {t(`Nog ${remaining} beschikbaar. Niet twijfelen.`, `Only ${remaining} left. Don't overthink it.`)}
        </p>
      )}

      {product.needsCustomName && (
        <input
          className="input"
          maxLength={20}
          placeholder={t('Naam op je polo', 'Name on your polo')}
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          aria-label={t('Naam voor de opdruk', 'Name for the print')}
        />
      )}

      <button
        type="button"
        className="btn-neon mt-2"
        disabled={soldOut || needsSize || needsName || needsDays}
        onClick={() => {
          add(
            product.id,
            product.perDay ? daysKey(days) : size,
            product.needsCustomName ? customName.trim() : undefined,
          )
          setCustomName('')
          setDays([])
        }}
      >
        {soldOut
          ? t('Helaas', 'Too late')
          : needsDays
            ? t('Kies eerst je dag(en)', 'Pick your day(s) first')
            : needsSize
              ? t('Kies eerst een maat', 'Pick a size first')
              : needsName
                ? t('Vul eerst de naam voor de opdruk in', 'Fill in the print name first')
                : t('In het mandje', 'Add to cart')}
      </button>
    </article>
  )
}
