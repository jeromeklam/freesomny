import { X } from 'lucide-react'
import { APP_VERSION, CHANGELOG } from '@api-client/shared'
import { useAppStore } from '../stores/app'
import { useTranslation } from '../hooks/useTranslation'
import { ResizableModal } from './ResizableModal'

export function ChangelogModal() {
  const showChangelog = useAppStore((s) => s.showChangelog)
  const setShowChangelog = useAppStore((s) => s.setShowChangelog)
  const { t } = useTranslation()

  if (!showChangelog) return null

  return (
    <ResizableModal
      storageKey="changelog"
      defaultWidth={560}
      defaultHeight={Math.min(window.innerHeight * 0.8, 520)}
      minWidth={380}
      minHeight={300}
      onClose={() => setShowChangelog(false)}
      className="bg-white dark:bg-gray-800"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            {t('changelog.title')}
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">v{APP_VERSION}</span>
          </h2>
          <button
            onClick={() => setShowChangelog(false)}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center px-2 py-0.5 text-sm font-semibold rounded bg-blue-600/30 text-blue-300 border border-blue-500/40">
                  v{entry.version}
                </span>
                <span className="text-sm text-gray-500">{entry.date}</span>
              </div>
              <ul className="space-y-1 ml-1">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-blue-400 mt-1 shrink-0">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </ResizableModal>
  )
}
