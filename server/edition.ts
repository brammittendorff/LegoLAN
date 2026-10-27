import { EDITION_YEAR } from '../shared/products'
import type { Env } from './types'

/**
 * Is de huidige editie voorbij? Admins zetten dit in Backstage. Dan stoppen
 * shop, plattegrond en de mails daaromheen; inloggen en foto's blijven werken.
 */
export async function editionFinished(env: Env): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT finished FROM edition_status WHERE edition = ?`)
    .bind(EDITION_YEAR)
    .first<{ finished: number }>()
  return row?.finished === 1
}
