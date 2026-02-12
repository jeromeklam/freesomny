import { useState } from 'react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { authApi, setAuthToken } from '../lib/api'
import { useTranslation } from '../hooks/useTranslation'

type AuthMode = 'login' | 'register' | 'forgot'

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)

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
        if (password !== confirmPassword) {
          setError(t('auth.passwordMismatch'))
          return
        }
        const response = await authApi.register({ email, password, name })
        if (response.requiresVerification) {
          setRegisterSuccess(true)
          return
        }
        setAuthToken(response.token)
        setUser(response.user)
      } else if (effectiveMode === 'forgot') {
        await authApi.forgotPassword(email)
        setForgotSuccess(true)
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

  const switchToForgot = () => {
    setError(null)
    setForgotSuccess(false)
    setMode('forgot')
  }

  const switchToLogin = () => {
    setError(null)
    setForgotSuccess(false)
    setMode('login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="FreeSomnia" className="h-24 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">FreeSomnia</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {setupRequired
              ? t('auth.createFirstAccount')
              : effectiveMode === 'forgot'
                ? t('auth.forgotPasswordTitle')
                : t('auth.welcomeBack')}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          {/* Mode Toggle (only show if not setup and not forgot) */}
          {!setupRequired && effectiveMode !== 'forgot' && (
            <div className="flex mb-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-1">
              <button
                onClick={() => { setMode('login'); setRegisterSuccess(false); setError(null) }}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  mode === 'login'
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {t('auth.login')}
              </button>
              <button
                onClick={() => { setMode('register'); setRegisterSuccess(false); setError(null) }}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  mode === 'register'
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {t('auth.register')}
              </button>
            </div>
          )}

          {/* Forgot Password Form */}
          {effectiveMode === 'forgot' ? (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <p className="text-sm text-green-400">{t('auth.forgotPasswordSuccess')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('auth.email')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      placeholder={t('auth.emailPlaceholder')}
                    />
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
                    {isLoading ? t('common.loading') : t('auth.forgotPasswordSend')}
                  </button>
                </form>
              )}

              <button
                onClick={switchToLogin}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mt-2"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          ) : registerSuccess ? (
            /* Registration success — verification needed */
            <div className="space-y-4">
              <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                <p className="text-sm text-green-400">{t('auth.registrationSuccess')}</p>
              </div>
              <button
                onClick={() => {
                  setRegisterSuccess(false)
                  setMode('login')
                }}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          ) : (
            /* Login / Register Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {effectiveMode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auth.name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    placeholder={t('auth.namePlaceholder')}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={t('auth.passwordPlaceholder')}
                />
                {effectiveMode === 'register' && (
                  <p className="text-xs text-gray-500 mt-1">{t('auth.passwordHint')}</p>
                )}
              </div>

              {effectiveMode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auth.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    placeholder={t('auth.confirmPassword')}
                  />
                </div>
              )}

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

              {/* Forgot password link (login mode only) */}
              {effectiveMode === 'login' && !setupRequired && (
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {t('auth.forgotPassword')}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
