import { useMemo, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import { getTranslations, t as translate, type Translations } from '../i18n'

export function useTranslation() {
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)

  const translations = useMemo(() => getTranslations(language), [language])

  const t = useCallback((key: string): string => translate(translations, key), [translations])

  return {
    t,
    language,
    setLanguage,
    translations,
  }
}
