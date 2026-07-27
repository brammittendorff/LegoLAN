export interface Env {
  DB: D1Database
  /** Mollie API key. Speciale waarde "fake" = direct-betaald-modus voor lokaal testen. */
  MOLLIE_API_KEY?: string
  MAILJET_API_KEY?: string
  MAILJET_API_SECRET?: string
  MAILJET_LIST_ID?: string
  CONTACT_EMAIL?: string
  FROM_EMAIL?: string
  FROM_NAME?: string
  TURNSTILE_SECRET_KEY?: string
  /** Lokaal mail vangen: URL van een Mailpit-instantie (bv. http://localhost:8025). Als dit gezet is gaat er níets naar Mailjet. */
  MAILPIT_URL?: string
  /** Geheim voor inloglinks + sessiecookies (openssl rand -hex 32) */
  AUTH_SECRET?: string
  /** Gedeeld geheim waarmee de cron-workflows endpoints mogen aanroepen */
  CRON_SECRET?: string
  /** Wasabi S3 met de foto's; map-per-editie (2024/, 2025/, ...) */
  WASABI_ENDPOINT?: string
  WASABI_REGION?: string
  WASABI_BUCKET?: string
  WASABI_ACCESS_KEY_ID?: string
  WASABI_SECRET_ACCESS_KEY?: string
}

export type OrderRow = {
  id: string
  created_at: number
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired' | 'refunded'
  name: string
  first_name: string | null
  last_name: string | null
  email: string
  amount_cents: number
  mollie_payment_id: string | null
  confirmation_sent: number
}

export type OrderItemRow = {
  order_id: string
  product_id: string
  size: string | null
  custom_name: string | null
  qty: number
  price_cents: number
}
