import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './lib/cart.tsx'
import { LangProvider } from './lib/i18n.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { EditionProvider } from './lib/edition.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LangProvider>
        <EditionProvider>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </EditionProvider>
      </LangProvider>
    </BrowserRouter>
  </StrictMode>,
)
