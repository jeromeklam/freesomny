import { useEffect } from 'react'
import { useAppStore, type Theme } from '../stores/app'

function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  useEffect(() => {
    if (theme === 'dark') {
      applyTheme(true)
    } else if (theme === 'light') {
      applyTheme(false)
    } else {
      // auto — follow system preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mq.matches)

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const cycleTheme = () => {
    const order: Theme[] = ['dark', 'light', 'auto']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  return { theme, setTheme, cycleTheme }
}
