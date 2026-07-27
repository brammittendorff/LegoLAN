// Actief jaarthema. Volgend jaar: wijs hier naar de nieuwe themamap.
import { useLang } from '../lib/i18n'
import { THEME } from './2026-stripclub/theme'

export { THEME }
export type { Theme, ThemeCopy } from './2026-stripclub/theme'

/** De copy van het actieve thema in de gekozen taal. */
export function useCopy() {
  const { lang } = useLang()
  return THEME.copy[lang]
}
