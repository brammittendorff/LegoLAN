import { useNavigate } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { getProduct, linePriceCents } from '../../shared/products'
import { euro } from '../lib/money'
import { useLang } from '../lib/i18n'

export default function CartDrawer() {
  const { items, setQty, remove, totalCents, drawerOpen, setDrawerOpen } = useCart()
  const { t, pick } = useLang()
  const navigate = useNavigate()

  if (!drawerOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70"
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-neon/30 bg-velvet p-6"
        aria-label={t('Winkelmandje', 'Shopping cart')}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-label text-sm uppercase tracking-[0.25em] text-bulb">
            {t('Je mandje', 'Your cart')}
          </h2>
          <button
            type="button"
            className="btn-ghost !px-3 !py-1 text-sm"
            onClick={() => setDrawerOpen(false)}
          >
            {t('Sluiten', 'Close')}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-10 text-center text-smoke/70">
            {t('Nog helemaal leeg. Gênant.', 'Completely empty. Embarrassing.')}
          </p>
        ) : (
          <ul className="mt-6 flex-1 space-y-4 overflow-y-auto">
            {items.map((item) => {
              const product = getProduct(item.productId)
              if (!product) return null
              return (
                <li
                  key={`${item.productId}-${item.size ?? ''}-${item.customName ?? ''}`}
                  className="card-velvet flex items-center gap-3 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-milk">
                      {pick(product.name)}
                      {item.size ? ` · ${item.size}` : ''}
                    </p>
                    {item.customName && (
                      <p className="text-xs text-smoke/70">
                        {t('Opdruk', 'Print')}: {item.customName}
                      </p>
                    )}
                    <p className="font-label text-xs text-bulb">
                      {euro(linePriceCents(product, item.size) * item.qty)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t('Eén minder', 'One less')}
                      className="h-7 w-7 rounded-full border border-grape/40 text-smoke hover:border-neon"
                      onClick={() => setQty(item, item.qty - 1)}
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-label text-sm text-milk">{item.qty}</span>
                    <button
                      type="button"
                      aria-label={t('Eén meer', 'One more')}
                      className="h-7 w-7 rounded-full border border-grape/40 text-smoke hover:border-neon"
                      onClick={() => setQty(item, item.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={t('Verwijderen', 'Remove')}
                    className="text-smoke/50 hover:text-neon"
                    onClick={() => remove(item)}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {items.length > 0 && (
          <div className="mt-6 border-t border-grape/30 pt-4">
            <div className="flex justify-between text-milk">
              <span>{t('Totaal', 'Total')}</span>
              <span className="font-label text-bulb">{euro(totalCents)}</span>
            </div>
            <button
              type="button"
              className="btn-neon mt-4 w-full"
              onClick={() => {
                setDrawerOpen(false)
                navigate('/checkout')
              }}
            >
              {t('Afrekenen', 'Checkout')}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
