import { useTranslation } from '../../hooks/useTranslation'

export interface PageState {
  offset: string
  limit: string
}

interface JsonApiPageBuilderProps {
  state: PageState
  onChange: (state: PageState) => void
}

export function JsonApiPageBuilder({ state, onChange }: JsonApiPageBuilderProps) {
  const { t } = useTranslation()

  const hasValues = state.offset.trim() !== '' || state.limit.trim() !== ''

  if (!hasValues) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 text-sm mb-4">{t('jsonapi.page.noPage')}</p>
        <button
          onClick={() => onChange({ offset: '0', limit: '25' })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
        >
          {t('jsonapi.page.setDefaults')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('jsonapi.page.offset')}</label>
          <input
            type="text"
            value={state.offset}
            onChange={(e) => onChange({ ...state, offset: e.target.value })}
            placeholder={t('jsonapi.page.offsetPlaceholder')}
            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('jsonapi.page.limit')}</label>
          <input
            type="text"
            value={state.limit}
            onChange={(e) => onChange({ ...state, limit: e.target.value })}
            placeholder={t('jsonapi.page.limitPlaceholder')}
            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <button
        onClick={() => onChange({ offset: '', limit: '' })}
        className="text-xs text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
      >
        {t('jsonapi.page.clear')}
      </button>
    </div>
  )
}
