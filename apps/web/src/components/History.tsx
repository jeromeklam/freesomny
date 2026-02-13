import { useState } from 'react'
import { X, Trash2, Search, Clock } from 'lucide-react'
import { ResizableModal } from './ResizableModal'
import { HistoryDetailModal } from './HistoryDetailModal'
import { clsx } from 'clsx'
import { useHistory, useClearHistory } from '../hooks/useApi'
import { useAppStore } from '../stores/app'
import { useTranslation } from '../hooks/useTranslation'

interface HistoryEntry {
  id: string
  method: string
  url: string
  resolvedUrl?: string | null
  responseStatus: number
  responseTime: number
  createdAt: string
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'text-green-400',
    POST: 'text-yellow-400',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-red-400',
    HEAD: 'text-gray-400',
    OPTIONS: 'text-gray-400',
  }

  return (
    <span className={clsx('text-xs font-mono font-semibold w-12', colors[method] || 'text-gray-400')}>
      {method}
    </span>
  )
}

function StatusBadge({ status }: { status: number }) {
  let color = 'text-gray-400'
  if (status >= 200 && status < 300) color = 'text-green-400'
  else if (status >= 300 && status < 400) color = 'text-blue-400'
  else if (status >= 400 && status < 500) color = 'text-yellow-400'
  else if (status >= 500) color = 'text-red-400'

  return <span className={clsx('text-xs font-mono', color)}>{status}</span>
}

export function History() {
  const [search, setSearch] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const showHistory = useAppStore((s) => s.showHistory)
  const setShowHistory = useAppStore((s) => s.setShowHistory)
  const { t } = useTranslation()

  const { data, isLoading } = useHistory({ search: search || undefined, limit: 50 })
  const clearHistory = useClearHistory()

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return t('history.justNow')
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  if (!showHistory) return null

  const entries = (data?.entries || []) as HistoryEntry[]

  const handleClear = () => {
    if (confirm(t('history.confirmClear'))) {
      clearHistory.mutate()
    }
  }

  return (
    <>
      <ResizableModal
        storageKey="history"
        defaultWidth={672}
        defaultHeight={Math.min(window.innerHeight * 0.8, 600)}
        minWidth={400}
        minHeight={300}
        onClose={() => setShowHistory(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold">{t('history.title')}</h2>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('history.search')}
              className="w-full pl-10 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleClear}
            disabled={entries.length === 0}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-400 hover:text-red-300 disabled:text-gray-600"
          >
            <Trash2 className="w-4 h-4" />
            {t('history.clearAll')}
          </button>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <p>{t('history.loading')}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mb-2 opacity-50" />
              <p>{t('history.noHistory')}</p>
              <p className="text-sm">{t('history.noHistoryDesc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => setSelectedEntryId(entry.id)}
                >
                  <MethodBadge method={entry.method} />
                  <StatusBadge status={entry.responseStatus} />
                  <span className="flex-1 truncate text-sm font-mono text-gray-700 dark:text-gray-300">
                    {entry.resolvedUrl || entry.url}
                  </span>
                  <span className="text-xs text-gray-500">{entry.responseTime}ms</span>
                  <span className="text-xs text-gray-500">{formatTime(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
          <span>{data?.total || 0} {t('history.entries')}</span>
          <button
            onClick={() => setShowHistory(false)}
            className="px-4 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {t('history.close')}
          </button>
        </div>
      </ResizableModal>

      {selectedEntryId && (
        <HistoryDetailModal
          entryId={selectedEntryId}
          onClose={() => setSelectedEntryId(null)}
        />
      )}
    </>
  )
}
