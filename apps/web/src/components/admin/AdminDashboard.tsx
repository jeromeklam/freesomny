import { useEffect, useState } from 'react'
import { Users, FolderOpen, Send, Globe, Mail } from 'lucide-react'
import { clsx } from 'clsx'
import { adminApi, type AdminStats } from '../../lib/api'
import { useTranslation } from '../../hooks/useTranslation'

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(() => {})
    adminApi.getSmtpStatus().then((s) => setSmtpConfigured(s.configured)).catch(() => {})
  }, [])

  if (!stats) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
    )
  }

  const cards = [
    { label: t('admin.dashboard.totalUsers'), value: stats.users, icon: Users, color: 'text-blue-400' },
    { label: t('admin.dashboard.totalGroups'), value: stats.groups, icon: Users, color: 'text-purple-400' },
    { label: t('admin.dashboard.totalCollections'), value: stats.collections, icon: FolderOpen, color: 'text-green-400' },
    { label: t('admin.dashboard.totalRequests'), value: stats.requests, icon: Send, color: 'text-orange-400' },
    { label: t('admin.dashboard.totalEnvironments'), value: stats.environments, icon: Globe, color: 'text-cyan-400' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <card.icon className={clsx('w-8 h-8', card.color)} />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{card.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SMTP Status */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.dashboard.smtpStatus')}</div>
            {smtpConfigured !== null && (
              <div className={clsx('text-xs mt-0.5', smtpConfigured ? 'text-green-400' : 'text-yellow-400')}>
                {smtpConfigured ? t('admin.dashboard.smtpConfigured') : t('admin.dashboard.smtpNotConfigured')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
