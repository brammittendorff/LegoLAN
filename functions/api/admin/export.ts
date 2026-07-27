import { EDITION_YEAR, getProduct } from '../../../shared/products'
import { buildRoom } from '../../../shared/seatmap'
import { emailFromRequest, isAdmin } from '../../../server/auth'
import { err } from '../../../server/http'
import type { Env } from '../../../server/types'

/*
 * CSV-export voor de administratie. Puntkomma's en een UTF-8 BOM zodat
 * (Nederlandse) Excel het bestand direct goed opent.
 */

const csvCell = (value: unknown): string => {
  let s = String(value ?? '')
  // Formule-injectie in Excel voorkomen: cellen die met =, +, -, @ of een
  // tab beginnen krijgen een apostrof, dan behandelt Excel ze als tekst.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

const toCsv = (header: string[], rows: unknown[][]): string =>
  '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email || !(await isAdmin(env, email))) return err('Geen toegang.', 403)

  const type = new URL(request.url).searchParams.get('type') ?? ''
  let csv: string

  if (type === 'orders') {
    const rs = await env.DB.prepare(
      `SELECT o.created_at, o.first_name, o.last_name, o.email, o.status,
              o.amount_cents, o.mollie_payment_id,
              group_concat(oi.qty || 'x ' || oi.product_id ||
                coalesce(' (' || oi.size || ')', '') ||
                coalesce(' "' || oi.custom_name || '"', ''), ' + ') AS items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.edition = ?
        GROUP BY o.id
        ORDER BY o.created_at`,
    )
      .bind(EDITION_YEAR)
      .all<Record<string, unknown>>()
    csv = toCsv(
      ['datum', 'voornaam', 'achternaam', 'email', 'status', 'bedrag_eur', 'items', 'mollie_id'],
      rs.results.map((r) => [
        new Date(Number(r.created_at)).toISOString().slice(0, 16).replace('T', ' '),
        r.first_name,
        r.last_name,
        r.email,
        r.status,
        (Number(r.amount_cents) / 100).toFixed(2).replace('.', ','),
        r.items,
        r.mollie_payment_id,
      ]),
    )
  } else if (type === 'seats') {
    const rs = await env.DB.prepare(
      `SELECT s.seat_id, s.nickname,
              COALESCE(o.name, trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))) AS name,
              COALESCE(o.email, s.owner_email) AS email
         FROM seats s
         LEFT JOIN orders o ON o.id = s.order_id
         LEFT JOIN users u ON u.email = s.owner_email
        WHERE s.edition = ? ORDER BY s.claimed_at`,
    )
      .bind(EDITION_YEAR)
      .all<Record<string, unknown>>()
    const seatNoById = new Map(
      buildRoom()
        .flat()
        .filter((c) => c.seatId)
        .map((c) => [c.seatId!, c.seatNo!]),
    )
    csv = toCsv(
      ['plek', 'nickname', 'naam', 'email'],
      rs.results.map((r) => [seatNoById.get(String(r.seat_id)) ?? r.seat_id, r.nickname, r.name, r.email]),
    )
  } else if (type === 'polos') {
    const rs = await env.DB.prepare(
      `SELECT oi.qty, oi.size, oi.custom_name, oi.product_id, o.name, o.email
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'paid' AND oi.custom_name IS NOT NULL AND o.edition = ?
        ORDER BY o.created_at`,
    )
      .bind(EDITION_YEAR)
      .all<Record<string, unknown>>()
    csv = toCsv(
      ['aantal', 'maat', 'opdruk', 'product', 'naam', 'email'],
      rs.results.map((r) => [
        r.qty,
        r.size,
        r.custom_name,
        getProduct(String(r.product_id))?.name.nl ?? r.product_id,
        r.name,
        r.email,
      ]),
    )
  } else {
    return err('Onbekend exporttype. Gebruik: orders, seats of polos.')
  }

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="legolan-${EDITION_YEAR}-${type}.csv"`,
    },
  })
}
