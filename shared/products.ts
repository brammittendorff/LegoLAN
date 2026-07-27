/*
 * De catalogus: één bron van waarheid voor zowel de site als de betaal-functies.
 * Prijzen staan in centen; de server rekent hiermee, dus knoeien in de browser
 * heeft geen zin.
 *
 * Jaarlijks bijwerken: namen, prijzen en capaciteit. Capaciteit van tickets
 * hoort samen op te tellen tot het aantal LAN-plekken in shared/seatmap.ts.
 */
import type { L10n } from './l10n'

/** Het jaar van de huidige editie; betaalde tickets geven fototoegang voor dit jaar. */
export const EDITION_YEAR = 2026

/**
 * Gedeelde voorraadpotten: producten met dezelfde `pool` delen één voorraad.
 * De huur-PC's zijn fysiek dezelfde twee machines, of je ze nu 1 of 3 dagen huurt.
 */
export const CAPACITY_POOLS: Record<string, number> = {
  computerhuur: 2, // 2 huur-PC's per dag
  dagticket: 40, // zaalcapaciteit per dag; praktisch onbeperkt
}

/** De dagen van het event (vr 9, za 10, zo 11 oktober). */
export const EVENT_DAYS = ['vr', 'za', 'zo'] as const
export type EventDay = (typeof EVENT_DAYS)[number]

/** "vr+zo" → ['vr','zo'] (gevalideerd en in vaste volgorde), anders null. */
export function parseDays(size: string | null | undefined): EventDay[] | null {
  if (!size) return null
  const parts = size.split('+')
  const days = EVENT_DAYS.filter((d) => parts.includes(d))
  return days.length === parts.length && days.length > 0 ? [...days] : null
}

/** Canonieke sleutel voor een dagselectie: altijd vr → za → zo volgorde. */
export function daysKey(days: readonly EventDay[]): string {
  return EVENT_DAYS.filter((d) => days.includes(d)).join('+')
}

/** Welke dagen dit orderregel-item een huur-PC bezet houdt. */
export function bookedDaysFor(
  product: Product,
  size: string | null | undefined,
): readonly EventDay[] | null {
  return product.perDay ? parseDays(size) : null
}

/** Regelprijs: per-dag-producten kosten priceCents keer het aantal dagen. */
export function linePriceCents(product: Product, size: string | null | undefined): number {
  if (!product.perDay) return product.priceCents
  return product.priceCents * (parseDays(size)?.length ?? 0)
}

export type Product = {
  id: string
  name: L10n
  tagline: L10n
  priceCents: number
  type: 'ticket' | 'merch' | 'extra'
  /** Alleen voor merch met maten */
  sizes?: readonly string[]
  /** null = onbeperkt (of: zie pool) */
  capacity: number | null
  /** Deelt voorraad met alle producten in dezelfde pool (zie CAPACITY_POOLS) */
  pool?: string
  /** Prijs geldt per gekozen eventdag; de koper kiest dagen op de productkaart */
  perDay?: boolean
  /** Aantal LAN-plekken dat één stuk geeft (alleen tickets) */
  seatsPerUnit?: number
  /** Vraagt bij bestellen om een naam voor de opdruk (bv. de polo) */
  needsCustomName?: boolean
}

export const PRODUCTS: readonly Product[] = [
  {
    id: 'ticket-weekend-2026',
    name: { nl: 'Weekend Ticket', en: 'Weekend Ticket' },
    tagline: {
      nl: 'Je backstage pass: het hele weekend toegang tot de club. Slaap is optioneel.',
      en: 'Your backstage pass: all-weekend access to the club. Sleep is optional.',
    },
    priceCents: 2500,
    type: 'ticket',
    capacity: 34, // de plattegrond heeft 40 plekken; 6 marge voor daggasten
    seatsPerUnit: 1,
  },
  {
    id: 'ticket-dag-2026',
    name: { nl: 'Dag Ticket', en: 'Day Ticket' },
    tagline: {
      nl: 'One night stand: kom een dag (of twee) langs. Geen verplichtingen, geen oordeel.',
      en: 'One night stand: drop by for a day (or two). No strings attached, no judgement.',
    },
    priceCents: 1000, // per dag
    type: 'ticket',
    capacity: null,
    pool: 'dagticket',
    perDay: true,
    seatsPerUnit: 1,
  },
  {
    id: 'computerhuur-2026',
    name: { nl: 'Computerhuur', en: 'PC rental' },
    tagline: {
      nl: 'Geen eigen rig mee? Wij leveren de paal... ehm, PC. Kies je dagen.',
      en: 'No rig of your own? We supply the pole... er, PC. Pick your days.',
    },
    priceCents: 2000, // per dag
    type: 'extra',
    capacity: null,
    pool: 'computerhuur',
    perDay: true,
  },
  {
    id: 'diner-zaterdag-2026',
    name: { nl: 'Luxe Diner (zaterdagavond)', en: 'Deluxe Dinner (Saturday night)' },
    tagline: {
      nl: 'Een luxe diner, zoals je van een echte club verwacht.',
      en: 'A deluxe dinner, as you would expect at a proper club.',
    },
    priceCents: 1800,
    type: 'extra',
    capacity: 50,
  },
  {
    id: 'polo-2026',
    name: { nl: 'Customized Polo', en: 'Customized Polo' },
    tagline: {
      nl: 'Met je eigen naam erop. Bewijs dat je bij de club hoort.',
      en: 'With your own name on it. Proof you belong to the club.',
    },
    priceCents: 2000,
    type: 'merch',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    capacity: null,
    needsCustomName: true,
  },
]

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
