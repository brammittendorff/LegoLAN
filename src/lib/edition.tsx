import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

type EditionCtx = {
  /** Is de huidige editie voorbij (Backstage-knop)? null = nog onbekend */
  finished: boolean | null
  setFinished: (finished: boolean) => void
}

const Ctx = createContext<EditionCtx | null>(null)
const CACHE_KEY = 'legolan-editie-voorbij'

// Laatst bekende stand, zodat terugkerende bezoekers geen flits van de
// verkeerde homepage zien. Mag ontbreken (privévenster e.d.).
function cached(): boolean | null {
  try {
    const v = localStorage.getItem(CACHE_KEY)
    return v === null ? null : v === '1'
  } catch {
    return null
  }
}

export function EditionProvider({ children }: { children: ReactNode }) {
  const [finished, setState] = useState<boolean | null>(cached)

  const setFinished = (value: boolean) => {
    setState(value)
    try {
      localStorage.setItem(CACHE_KEY, value ? '1' : '0')
    } catch {
      /* geen opslag: prima */
    }
  }

  useEffect(() => {
    api
      .edition()
      .then((r) => setFinished(r.finished))
      .catch(() => setState((prev) => prev ?? false))
  }, [])

  return <Ctx.Provider value={{ finished, setFinished }}>{children}</Ctx.Provider>
}

export function useEdition(): EditionCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEdition buiten EditionProvider gebruikt')
  return ctx
}
