import { useState } from 'react'
import { authApi } from '../lib/api'
import { useTranslation } from '../hooks/useTranslation'

export function ResetPasswordScreen() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { t } = useTranslation()

  const token = new URLSearchParams(window.location.search).get('token') || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setIsLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetPasswordInvalid'))
    } finally {
      setIsLoading(false)
    }
  }

  const goToLogin = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">FreeSomnia</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t('auth.resetPasswordTitle')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          {success ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                <p className="text-sm text-green-400">{t('auth.resetPasswordSuccess')}</p>
              </div>
              <button
                onClick={goToLogin}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {t('auth.signIn')}
              </button>
            </div>
          ) : !token ? (
            <div className="space-y-4">
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-400">{t('auth.resetPasswordInvalid')}</p>
              </div>
              <button
                onClick={goToLogin}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.newPassword')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

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
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
                {isLoading ? t('common.loading') : t('auth.resetPasswordSubmit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
