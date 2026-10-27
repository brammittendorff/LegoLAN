import { EDITION_YEAR } from '../../shared/products'
import { editionFinished } from '../../server/edition'
import { json } from '../../server/http'
import type { Env } from '../../server/types'

/** Publiek: loopt de huidige editie nog, of is het een terugblik? */
export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({ year: EDITION_YEAR, finished: await editionFinished(env) })
