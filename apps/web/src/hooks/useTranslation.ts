import { useMemo } from 'react'
import { useAppStore } from '../stores/app'
import { getTranslations, t as translate, type Translations } from '../i18n'

export function useTranslation() {
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)

  const translations = useMemo(() => getTranslations(language), [language])

  const t = (key: string): string => translate(translations, key)

  return {
    t,
    language,
    setLanguage,
    translations,
  }
}
