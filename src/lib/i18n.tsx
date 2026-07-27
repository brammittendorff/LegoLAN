import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { L10n, Lang } from '../../shared/l10n'

type LangCtx = {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Korte inline vertaling: t('Nederlands', 'English') */
  t: (nl: string, en: string) => string
  /** Kies de juiste taal uit een {nl, en}-object */
  pick: (value: L10n) => string
}

const Ctx = createContext<LangCtx | null>(null)
const STORAGE_KEY = 'legolan-lang'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'nl'
    } catch {
      return 'nl'
    }
  })

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* volgende bezoek dan weer Nederlands, prima */
    }
  }

  const t = (nl: string, en: string) => (lang === 'nl' ? nl : en)
  const pick = (value: L10n) => value[lang]

  return <Ctx.Provider value={{ lang, setLang, t, pick }}>{children}</Ctx.Provider>
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang buiten LangProvider gebruikt')
  return ctx
}
