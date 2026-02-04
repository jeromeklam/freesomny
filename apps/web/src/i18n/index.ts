import en from './en.json'
import fr from './fr.json'

export type Language = 'en' | 'fr'

export const languages: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

const translations: Record<Language, typeof en> = {
  en,
  fr,
}

export function getTranslations(lang: Language) {
  return translations[lang] || translations.en
}

// Helper to get nested keys like "environment.title"
export function t(translations: typeof en, key: string): string {
  const keys = key.split('.')
  let value: unknown = translations
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return key // Return key if not found
    }
  }
  return typeof value === 'string' ? value : key
}

export type Translations = typeof en
