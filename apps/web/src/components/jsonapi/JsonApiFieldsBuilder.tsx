import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '../../hooks/useTranslation'

export interface FieldsetEntry {
  id: string
  resourceType: string
  fields: string
}

interface JsonApiFieldsBuilderProps {
  entries: FieldsetEntry[]
  onChange: (entries: FieldsetEntry[]) => void
}

let nextId = 1
function genId() {
  return `fields_${Date.now()}_${nextId++}`
}

export function JsonApiFieldsBuilder({ entries, onChange }: JsonApiFieldsBuilderProps) {
  const { t } = useTranslation()

  const handleAdd = () => {
    onChange([...entries, { id: genId(), resourceType: '', fields: '' }])
  }

  const handleRemove = (id: string) => {
    onChange(entries.filter((e) => e.id !== id))
  }

  const handleChange = (id: string, key: keyof FieldsetEntry, value: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [key]: value } : e)))
  }

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 text-sm mb-4">{t('jsonapi.fields.noFields')}</p>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
        >
          <Plus className="w-4 h-4" />
          {t('jsonapi.fields.addFieldset')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-2 group">
          <input
            type="text"
            value={entry.resourceType}
            onChange={(e) => handleChange(entry.id, 'resourceType', e.target.value)}
            placeholder={t('jsonapi.fields.resourceTypePlaceholder')}
            className="w-40 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <span className="text-gray-600 text-sm">=</span>
          <input
            type="text"
            value={entry.fields}
            onChange={(e) => handleChange(entry.id, 'fields', e.target.value)}
            placeholder={t('jsonapi.fields.fieldsPlaceholder')}
            className="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
          />
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
        {t('jsonapi.fields.addFieldset')}
      </button>
    </div>
  )
}
