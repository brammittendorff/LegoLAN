import { EDITION_YEAR } from '../../../shared/products'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err, json } from '../../../server/http'
import type { Env } from '../../../server/types'

/**
 * Tijdreeksen voor het Grafieken-tabblad in Backstage: alles per dag
 * (YYYY-MM-DD). Tijdstempels staan in milliseconden, vandaar de /1000.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const perDag = async (sql: string, ...binds: unknown[]) => {
    const rs = await env.DB.prepare(sql)
      .bind(...binds)
      .all<{ day: string; n: number; cents: number | null }>()
    return rs.results
  }

  const omzet = await perDag(
    `SELECT date(created_at / 1000, 'unixepoch') AS day,
            COUNT(*) AS n, SUM(amount_cents) AS cents
       FROM orders WHERE status = 'paid' AND edition = ?
      GROUP BY day ORDER BY day`,
    EDITION_YEAR,
  )

  const plekken = await perDag(
    `SELECT date(claimed_at / 1000, 'unixepoch') AS day, COUNT(*) AS n, NULL AS cents
       FROM seats WHERE edition = ?
      GROUP BY day ORDER BY day`,
    EDITION_YEAR,
  )

  // Per gebruiker alleen de laatste login; een activiteitsbeeld, geen logboek.
  const logins = await perDag(
    `SELECT date(last_login_at / 1000, 'unixepoch') AS day, COUNT(*) AS n, NULL AS cents
       FROM users WHERE last_login_at IS NOT NULL
      GROUP BY day ORDER BY day`,
  )

  const accounts = await perDag(
    `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n, NULL AS cents
       FROM users WHERE created_at IS NOT NULL
      GROUP BY day ORDER BY day`,
  )

  const totals = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM orders WHERE status = 'paid' AND edition = ?1) AS paidOrders,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM orders WHERE status = 'paid' AND edition = ?1) AS revenueCents,
       (SELECT COUNT(*) FROM seats WHERE edition = ?1) AS seatsClaimed,
       (SELECT COUNT(*) FROM users) AS accounts`,
  )
    .bind(EDITION_YEAR)
    .first<{ paidOrders: number; revenueCents: number; seatsClaimed: number; accounts: number }>()

  return json({ edition: EDITION_YEAR, omzet, plekken, logins, accounts, totals })
}
