import { useState } from 'react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { authApi, setAuthToken } from '../lib/api'
import { useTranslation } from '../hooks/useTranslation'

type AuthMode = 'login' | 'register'

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const setUser = useAppStore((s) => s.setUser)
  const setupRequired = useAppStore((s) => s.setupRequired)
  const { t } = useTranslation()

  // If setup is required, force register mode
  const effectiveMode = setupRequired ? 'register' : mode

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (effectiveMode === 'register') {
        const response = await authApi.register({ email, password, name })
        setAuthToken(response.token)
        setUser(response.user)
      } else {
        const response = await authApi.login({ email, password })
        setAuthToken(response.token)
        setUser(response.user)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">FreeSomnia</h1>
          <p className="text-gray-400 mt-2">
            {setupRequired
              ? t('auth.createFirstAccount')
              : t('auth.welcomeBack')}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          {/* Mode Toggle (only show if not setup) */}
          {!setupRequired && (
            <div className="flex mb-6 bg-gray-900 rounded-lg p-1">
              <button
                onClick={() => setMode('login')}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  mode === 'login'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {t('auth.login')}
              </button>
              <button
                onClick={() => setMode('register')}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  mode === 'register'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {t('auth.register')}
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {effectiveMode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('auth.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={t('auth.namePlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder={t('auth.passwordPlaceholder')}
              />
              {effectiveMode === 'register' && (
                <p className="text-xs text-gray-500 mt-1">{t('auth.passwordHint')}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isLoading
                ? t('common.loading')
                : effectiveMode === 'register'
                  ? t('auth.createAccount')
                  : t('auth.signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
