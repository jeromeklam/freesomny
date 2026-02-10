import { Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from '../../hooks/useTranslation'

export interface IncludeRelation {
  id: string
  name: string
  enabled: boolean
}

interface JsonApiIncludeBuilderProps {
  relations: IncludeRelation[]
  onChange: (relations: IncludeRelation[]) => void
}

let nextId = 1
function genId() {
  return `inc_${Date.now()}_${nextId++}`
}

export function JsonApiIncludeBuilder({ relations, onChange }: JsonApiIncludeBuilderProps) {
  const { t } = useTranslation()

  const handleAdd = () => {
    onChange([...relations, { id: genId(), name: '', enabled: true }])
  }

  const handleRemove = (id: string) => {
    onChange(relations.filter((r) => r.id !== id))
  }

  const handleChange = (id: string, field: keyof IncludeRelation, value: string | boolean) => {
    onChange(relations.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  if (relations.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 text-sm mb-4">{t('jsonapi.include.noInclude')}</p>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
        >
          <Plus className="w-4 h-4" />
          {t('jsonapi.include.addRelation')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {relations.map((rel) => (
        <div key={rel.id} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={rel.enabled}
            onChange={(e) => handleChange(rel.id, 'enabled', e.target.checked)}
            className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
          />
          <input
            type="text"
            value={rel.name}
            onChange={(e) => handleChange(rel.id, 'name', e.target.value)}
            placeholder={t('jsonapi.include.relation')}
            className={clsx(
              'flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono',
              'focus:outline-none focus:border-blue-500',
              !rel.enabled && 'opacity-50'
            )}
          />
          <button
            onClick={() => handleRemove(rel.id)}
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
        {t('jsonapi.include.addRelation')}
      </button>
    </div>
  )
}
