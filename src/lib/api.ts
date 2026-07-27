import type { L10n } from '../../shared/l10n'

export type Profile = {
  email: string
  firstName: string
  lastName: string
  nickname: string
  role: 'user' | 'admin'
  editions: number[]
  seats: { edition: number; seatId: string; seatNo: number; nickname: string }[]
}

export type AdminOverview = {
  edition: number
  orders: {
    id: string
    createdAt: number
    name: string
    email: string
    amountCents: number
    status: string
    items: string | null
  }[]
  stats: { productId: string; sold: number; revenueCents: number }[]
  seats: { seatId: string; nickname: string; name: string; email: string }[]
  polos: {
    itemId: number
    name: string
    email: string
    size: string | null
    customName: string
    qty: number
  }[]
  attendees: { edition: number; n: number }[]
}

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'expired' | 'refunded'

export type OrderInfo = {
  status: OrderStatus
  amountCents: number
  items: { name: L10n; qty: number; size?: string; customName?: string }[]
  /** Aantal te claimen plekken (alleen bij betaalde orders) */
  seatQuota: number
  seatsClaimed: { seatId: string; nickname: string }[]
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? 'Er ging iets mis. Probeer het nog eens.'
    throw new Error(msg)
  }
  return data as T
}

const post = <T,>(url: string, body: unknown) =>
  req<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export const api = {
  stock: () => req<{ stock: Record<string, number | null> }>('/api/stock'),

  checkout: (payload: {
    firstName: string
    lastName: string
    email: string
    items: { productId: string; size?: string; customName?: string; qty: number }[]
  }) => post<{ checkoutUrl: string }>('/api/checkout', payload),

  order: (id: string) => req<OrderInfo>(`/api/order/${encodeURIComponent(id)}`),

  seats: () => req<{ seats: { seatId: string; nickname: string }[] }>('/api/seats'),

  claimSeat: (payload: { orderId: string; seatId: string; nickname: string }) =>
    post<{ ok: true }>('/api/seats/claim', payload),

  subscribe: (payload: { email: string; turnstileToken: string }) =>
    post<{ ok: true }>('/api/subscribe', payload),

  contact: (payload: { name: string; email: string; message: string; turnstileToken: string }) =>
    post<{ ok: true }>('/api/contact', payload),

  authLogin: (payload: { email: string; turnstileToken: string; next?: string }) =>
    post<{ status: 'sent' | 'unknown' }>('/api/auth/login', payload),

  authRegister: (payload: {
    email: string
    firstName: string
    lastName: string
    nickname: string
    turnstileToken: string
    next?: string
  }) => post<{ status: 'sent' }>('/api/auth/register', payload),

  authLogout: () => post<{ ok: true }>('/api/auth/logout', {}),

  me: () => req<Profile>('/api/me'),

  updateMe: (payload: { firstName: string; lastName: string; nickname: string }) =>
    req<{ ok: true }>('/api/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  adminOverview: () => req<AdminOverview>('/api/admin/overview'),

  adminReleaseSeat: (seatId: string) =>
    req<{ ok: true; released: boolean }>(`/api/admin/seat?seatId=${encodeURIComponent(seatId)}`, {
      method: 'DELETE',
    }),

  adminCancelOrder: (orderId: string) =>
    req<{ ok: true }>('/api/admin/order', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, action: 'cancel' }),
    }),

  adminUpdatePolo: (payload: { itemId: number; customName: string; size?: string }) =>
    req<{ ok: true }>('/api/admin/polo', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  photos: () =>
    req<{
      configured: boolean
      albums: { edition: number; photos: { key: string; url: string }[] }[]
    }>('/api/photos'),
}
