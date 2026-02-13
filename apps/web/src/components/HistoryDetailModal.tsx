import { useState } from 'react'
import { X, Globe, ArrowUpRight, ArrowDownLeft, Copy, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { ResizableModal } from './ResizableModal'
import { useHistoryEntry } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'

interface HistoryDetailModalProps {
  entryId: string
  onClose: () => void
}

type DetailTab = 'general' | 'request' | 'response'

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-500/20 text-green-400',
    POST: 'bg-yellow-500/20 text-yellow-400',
    PUT: 'bg-blue-500/20 text-blue-400',
    PATCH: 'bg-purple-500/20 text-purple-400',
    DELETE: 'bg-red-500/20 text-red-400',
    HEAD: 'bg-gray-500/20 text-gray-400',
    OPTIONS: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-mono font-bold', colors[method] || 'bg-gray-500/20 text-gray-400')}>
      {method}
    </span>
  )
}

function StatusBadge({ status }: { status: number }) {
  let color = 'bg-gray-500/20 text-gray-400'
  if (status >= 200 && status < 300) color = 'bg-green-500/20 text-green-400'
  else if (status >= 300 && status < 400) color = 'bg-blue-500/20 text-blue-400'
  else if (status >= 400 && status < 500) color = 'bg-yellow-500/20 text-yellow-400'
  else if (status >= 500) color = 'bg-red-500/20 text-red-400'

  return <span className={clsx('px-2 py-0.5 rounded text-xs font-mono font-bold', color)}>{status}</span>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const { t } = useTranslation()
  const entries = Object.entries(headers)

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 italic py-4 text-center">{t('history.detail.noHeaders')}</p>
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
          {entries.map(([key, value]) => (
            <tr key={key} className="hover:bg-gray-100/50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-1.5 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap align-top">{key}</td>
              <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BodyViewer({ body, contentType }: { body: string | null | undefined; contentType?: string }) {
  const { t } = useTranslation()

  if (!body) {
    return <p className="text-sm text-gray-500 italic py-4 text-center">{t('history.detail.noBody')}</p>
  }

  // Try to format JSON
  let formatted = body
  const isJson = contentType?.includes('json') || body.trimStart().startsWith('{') || body.trimStart().startsWith('[')
  if (isJson) {
    try {
      formatted = JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      // Not valid JSON, keep as-is
    }
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <CopyButton text={body} />
      </div>
      <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all overflow-auto max-h-[400px] bg-gray-50 dark:bg-gray-900/50 rounded text-gray-800 dark:text-gray-200">
        {formatted}
      </pre>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function HistoryDetailModal({ entryId, onClose }: HistoryDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('general')
  const { data: entry, isLoading } = useHistoryEntry(entryId)
  const { t } = useTranslation()

  const tabs: { key: DetailTab; label: string; icon: typeof Globe }[] = [
    { key: 'general', label: t('history.detail.general'), icon: Globe },
    { key: 'request', label: t('history.detail.request'), icon: ArrowUpRight },
    { key: 'response', label: t('history.detail.response'), icon: ArrowDownLeft },
  ]

  // Parse headers from entry
  const requestHeaders = entry?.requestHeaders && typeof entry.requestHeaders === 'object'
    ? entry.requestHeaders as Record<string, string>
    : {}
  const resolvedHeaders = entry?.resolvedHeaders && typeof entry.resolvedHeaders === 'object'
    ? entry.resolvedHeaders as Record<string, string>
    : null
  const responseHeaders = entry?.responseHeaders && typeof entry.responseHeaders === 'object'
    ? entry.responseHeaders as Record<string, string>
    : {}

  const displayHeaders = resolvedHeaders || requestHeaders
  const responseContentType = responseHeaders['content-type'] || responseHeaders['Content-Type'] || ''

  return (
    <ResizableModal
      storageKey="history-detail"
      defaultWidth={720}
      defaultHeight={Math.min(window.innerHeight * 0.85, 680)}
      minWidth={480}
      minHeight={350}
      onClose={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          {entry && <MethodBadge method={entry.method} />}
          {entry && <StatusBadge status={entry.responseStatus} />}
          <span className="text-sm font-mono text-gray-600 dark:text-gray-300 truncate">
            {entry?.resolvedUrl || entry?.url || '...'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors',
              activeTab === key
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <p>Loading...</p>
          </div>
        ) : !entry ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <p>Entry not found</p>
          </div>
        ) : activeTab === 'general' ? (
          <div className="p-6 space-y-4">
            {/* URL */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {entry.resolvedUrl ? t('history.detail.resolvedUrl') : 'URL'}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded text-gray-800 dark:text-gray-200 break-all">
                  {entry.resolvedUrl || entry.url}
                </code>
                <CopyButton text={entry.resolvedUrl || entry.url} />
              </div>
            </div>

            {/* Template URL (if different from resolved) */}
            {entry.resolvedUrl && entry.resolvedUrl !== entry.url && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('history.detail.templateUrl')}
                </label>
                <div className="mt-1">
                  <code className="text-sm font-mono bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded text-gray-500 dark:text-gray-400 block break-all">
                    {entry.url}
                  </code>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('history.detail.status')}
                </label>
                <div className="mt-1">
                  <StatusBadge status={entry.responseStatus} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('history.detail.time')}
                </label>
                <p className="mt-1 text-sm font-mono text-gray-700 dark:text-gray-300">{entry.responseTime}ms</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('history.detail.size')}
                </label>
                <p className="mt-1 text-sm font-mono text-gray-700 dark:text-gray-300">{formatBytes(entry.responseSize)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('history.detail.date')}
                </label>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'request' ? (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                {t('history.detail.headers')}
              </h3>
              <HeadersTable headers={displayHeaders} />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                {t('history.detail.body')}
              </h3>
              <BodyViewer body={entry.requestBody} contentType={displayHeaders['Content-Type'] || displayHeaders['content-type']} />
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 px-2 pb-2">
              <StatusBadge status={entry.responseStatus} />
              <span className="text-sm text-gray-500">{entry.responseTime}ms</span>
              <span className="text-sm text-gray-500">{formatBytes(entry.responseSize)}</span>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                {t('history.detail.headers')}
              </h3>
              <HeadersTable headers={responseHeaders} />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                {t('history.detail.body')}
              </h3>
              <BodyViewer body={entry.responseBody} contentType={responseContentType} />
            </div>
          </div>
        )}
      </div>
    </ResizableModal>
  )
}
