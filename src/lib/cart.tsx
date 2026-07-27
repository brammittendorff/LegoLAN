import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getProduct, linePriceCents } from '../../shared/products'

export type CartItem = { productId: string; size?: string; customName?: string; qty: number }

type CartCtx = {
  items: CartItem[]
  add: (productId: string, size?: string, customName?: string) => void
  setQty: (item: CartItem, qty: number) => void
  remove: (item: CartItem) => void
  clear: () => void
  totalCents: number
  count: number
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

const Ctx = createContext<CartCtx | null>(null)
const STORAGE_KEY = 'legolan-cart-2026'

function load(): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return (parsed as CartItem[]).filter((i) => getProduct(i.productId) && i.qty > 0)
  } catch {
    return []
  }
}

const same = (a: CartItem, b: Pick<CartItem, 'productId' | 'size' | 'customName'>) =>
  a.productId === b.productId && a.size === b.size && a.customName === b.customName

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const add = (productId: string, size?: string, customName?: string) => {
    setItems((prev) => {
      const hit = prev.find((i) => same(i, { productId, size, customName }))
      if (hit) {
        return prev.map((i) => (same(i, { productId, size, customName }) ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, { productId, size, customName, qty: 1 }]
    })
    setDrawerOpen(true)
  }

  const setQty = (item: CartItem, qty: number) => {
    setItems((prev) =>
      qty <= 0 ? prev.filter((i) => !same(i, item)) : prev.map((i) => (same(i, item) ? { ...i, qty } : i)),
    )
  }

  const remove = (item: CartItem) => setQty(item, 0)
  const clear = () => setItems([])

  const totalCents = useMemo(
    () =>
      items.reduce((sum, i) => {
        const product = getProduct(i.productId)
        return sum + (product ? linePriceCents(product, i.size) : 0) * i.qty
      }, 0),
    [items],
  )
  const count = useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items])

  return (
    <Ctx.Provider
      value={{ items, add, setQty, remove, clear, totalCents, count, drawerOpen, setDrawerOpen }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart buiten CartProvider gebruikt')
  return ctx
}
