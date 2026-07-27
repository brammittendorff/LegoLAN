/*
 * De plattegrond van de zaal, als tekening. Eén teken per vak:
 *
 *   #  LAN-plek
 *   B  bar                     D  deur
 *   S  netwerkswitch           F  openhaard / chillhoek
 *   .  vloer                   (spatie) niets
 *
 * Plekken krijgen automatisch een nummer: links → rechts, boven → onder.
 * Jaarlijks aanpassen mag gerust; geclaimde plekken staan in de database
 * onder een positie-id (r<rij>c<kolom>), dus verbouw de zaal vóór de
 * kaartverkoop start.
 */

export const ROOM_NAME = 'DE ZAAL'

// Overgenomen van de LAN AREA-plattegrond van 2025.
export const ROOM_ROWS: readonly string[] = [
  'BBBBB##..########',
  'BBBBB##..........',
  'BBBBB##.........F',
  'BBBBB##..######SF',
  'BBBBB##..######SF',
  'DBBBB##.........F',
  'BBBBB............',
  'BBBBBBDDD########',
]

export type CellKind =
  | 'seat'
  | 'bar'
  | 'door'
  | 'switch'
  | 'chill'
  | 'floor'
  | 'void'

export type Cell = {
  kind: CellKind
  row: number
  col: number
  seatId?: string
  seatNo?: number
}

const CHAR_KIND: Record<string, CellKind> = {
  '#': 'seat',
  B: 'bar',
  D: 'door',
  S: 'switch',
  F: 'chill',
  '.': 'floor',
  ' ': 'void',
}

export function buildRoom(): Cell[][] {
  let seatNo = 0
  return ROOM_ROWS.map((rowStr, row) =>
    [...rowStr].map((ch, col) => {
      const kind = CHAR_KIND[ch] ?? 'void'
      const cell: Cell = { kind, row, col }
      if (kind === 'seat') {
        seatNo += 1
        cell.seatNo = seatNo
        cell.seatId = `r${row}c${col}`
      }
      return cell
    }),
  )
}

/** Alle geldige plek-ids, voor validatie op de server */
export function allSeatIds(): Set<string> {
  const ids = new Set<string>()
  for (const row of buildRoom()) {
    for (const cell of row) {
      if (cell.seatId) ids.add(cell.seatId)
    }
  }
  return ids
}
