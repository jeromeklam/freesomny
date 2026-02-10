import { useEffect, useState, useCallback } from 'react'
import { adminApi, type AuditEntry } from '../../lib/api'
import { useTranslation } from '../../hooks/useTranslation'

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useTranslation()

  const loadEntries = useCallback((offset = 0) => {
    setIsLoading(true)
    adminApi
      .getAuditLog({ limit: 50, offset })
      .then((data) => {
        if (offset === 0) {
          setEntries(data.entries)
        } else {
          setEntries((prev) => [...prev, ...data.entries])
        }
        setTotal(data.total)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString()
  }

  const formatAction = (action: string) => {
    return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const parseDetails = (detailsStr: string): Record<string, unknown> => {
    try {
      return JSON.parse(detailsStr)
    } catch {
      return {}
    }
  }

  if (isLoading && entries.length === 0) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
  }

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">{t('admin.audit.noEntries')}</div>
    )
  }

  return (
    <div className="p-4 space-y-1">
      {entries.map((entry) => {
        const details = parseDetails(entry.details)
        return (
          <div
            key={entry.id}
            className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">
              {formatTime(entry.createdAt)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700 dark:text-gray-300">{formatAction(entry.action)}</div>
              {Object.keys(details).length > 0 && (
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {Object.entries(details)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ')}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {entries.length < total && (
        <button
          onClick={() => loadEntries(entries.length)}
          disabled={isLoading}
          className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          {isLoading ? t('common.loading') : t('admin.audit.loadMore')}
        </button>
      )}
    </div>
  )
}
