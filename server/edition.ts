import { EDITION_FINISHED } from '../shared/products'
import type { Env } from './types'

/**
 * Is de huidige editie voorbij (zie EDITION_FINISHED)? De tests zetten
 * EDITION_FORCE_OPEN=1 zodat ze de shop en plattegrond kunnen blijven testen.
 */
export function editionFinished(env: Env): boolean {
  return EDITION_FINISHED && env.EDITION_FORCE_OPEN !== '1'
}
