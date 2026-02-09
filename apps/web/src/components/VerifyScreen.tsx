import { useState, useEffect } from 'react'
import { authApi } from '../lib/api'
import { useTranslation } from '../hooks/useTranslation'

export function VerifyScreen() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const { t } = useTranslation()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      setStatus('error')
      setMessage(t('auth.invalidVerifyLink'))
      return
    }

    authApi.verify(token)
      .then((response) => {
        setStatus('success')
        setMessage(response.message || t('auth.emailVerified'))
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : t('auth.invalidVerifyLink'))
      })
  }, [t])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">FreeSomnia</h1>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          {status === 'loading' && (
            <p className="text-center text-gray-400">{t('common.loading')}</p>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                <p className="text-sm text-green-400">{message}</p>
              </div>
              <a
                href="/"
                className="block w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                {t('auth.backToLogin')}
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-400">{message}</p>
              </div>
              <a
                href="/"
                className="block w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                {t('auth.backToLogin')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
