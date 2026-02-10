import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '../../hooks/useTranslation'

export interface OptionEntry {
  id: string
  key: string
  enabled: boolean
}

interface JsonApiOptionBuilderProps {
  entries: OptionEntry[]
  onChange: (entries: OptionEntry[]) => void
}

let nextId = 1
function genId() {
  return `opt_${Date.now()}_${nextId++}`
}

export function JsonApiOptionBuilder({ entries, onChange }: JsonApiOptionBuilderProps) {
  const { t } = useTranslation()

  const handleAdd = () => {
    onChange([...entries, { id: genId(), key: '', enabled: true }])
  }

  const handleRemove = (id: string) => {
    onChange(entries.filter((e) => e.id !== id))
  }

  const handleChange = (id: string, key: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, key } : e)))
  }

  const handleToggle = (id: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)))
  }

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 text-sm mb-4">{t('jsonapi.option.noOptions')}</p>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
        >
          <Plus className="w-4 h-4" />
          {t('jsonapi.option.addOption')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={entry.enabled}
            onChange={() => handleToggle(entry.id)}
            className="w-4 h-4 text-blue-600 bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded"
          />
          <span className="text-gray-500 text-sm font-mono">option[</span>
          <input
            type="text"
            value={entry.key}
            onChange={(e) => handleChange(entry.id, e.target.value)}
            placeholder={t('jsonapi.option.keyPlaceholder')}
            className="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <span className="text-gray-500 text-sm font-mono">]</span>
          <button
            onClick={() => handleRemove(entry.id)}
            className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="flex items-center gap-1 mt-3 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
      >
        <Plus className="w-4 h-4" />
        {t('jsonapi.option.addOption')}
      </button>
    </div>
  )
}
