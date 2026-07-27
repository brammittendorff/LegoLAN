import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import Home from './pages/Home'
import Shop from './pages/Shop'
import Checkout from './pages/Checkout'
import Zaal from './pages/Zaal'
import Fotos from './pages/Fotos'
import Account from './pages/Account'
import Admin from './pages/Admin'
import Contact from './pages/Contact'
import Bedankt from './pages/Bedankt'
import Oeps from './pages/Oeps'
import NotFound from './pages/NotFound'

const PAGE_TITLES: Record<string, string> = {
  '/': 'LEGOLAN 2026 · Stripclub Editie · 9-11 oktober, Hengelo',
  '/shop': 'Shop · LEGOLAN 2026',
  '/zaal': 'De Zaal · LEGOLAN 2026',
  '/fotos': "Foto's · LEGOLAN 2026",
  '/contact': 'Contact · LEGOLAN 2026',
  '/account': 'Account · LEGOLAN 2026',
  '/admin': 'Backstage · LEGOLAN 2026',
  '/checkout': 'Afrekenen · LEGOLAN 2026',
  '/bedankt': 'Bedankt · LEGOLAN 2026',
  '/oeps': 'Oeps · LEGOLAN 2026',
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = PAGE_TITLES[pathname] ?? 'LEGOLAN 2026'
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Nav />
      <CartDrawer />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/zaal" element={<Zaal />} />
          <Route path="/fotos" element={<Fotos />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/bedankt" element={<Bedankt />} />
          <Route path="/oeps" element={<Oeps />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
