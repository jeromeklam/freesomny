import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from '../../hooks/useTranslation'

export interface SortField {
  id: string
  field: string
  direction: 'asc' | 'desc'
}

interface JsonApiSortBuilderProps {
  fields: SortField[]
  onChange: (fields: SortField[]) => void
}

let nextId = 1
function genId() {
  return `sort_${Date.now()}_${nextId++}`
}

export function JsonApiSortBuilder({ fields, onChange }: JsonApiSortBuilderProps) {
  const { t } = useTranslation()

  const handleAdd = () => {
    onChange([...fields, { id: genId(), field: '', direction: 'asc' }])
  }

  const handleRemove = (id: string) => {
    onChange(fields.filter((f) => f.id !== id))
  }

  const handleChange = (id: string, key: keyof SortField, value: string) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)))
  }

  const toggleDirection = (id: string) => {
    onChange(
      fields.map((f) =>
        f.id === id ? { ...f, direction: f.direction === 'asc' ? 'desc' : 'asc' } : f
      )
    )
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const newFields = [...fields]
    ;[newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]]
    onChange(newFields)
  }

  const moveDown = (index: number) => {
    if (index === fields.length - 1) return
    const newFields = [...fields]
    ;[newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]]
    onChange(newFields)
  }

  if (fields.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 text-sm mb-4">{t('jsonapi.sort.noSort')}</p>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
        >
          <Plus className="w-4 h-4" />
          {t('jsonapi.sort.addField')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {fields.map((sortField, index) => (
        <div key={sortField.id} className="flex items-center gap-2 group">
          {/* Priority indicator */}
          <span className="text-xs text-gray-600 w-5 text-center font-mono">{index + 1}</span>

          {/* Field name */}
          <input
            type="text"
            value={sortField.field}
            onChange={(e) => handleChange(sortField.id, 'field', e.target.value)}
            placeholder={t('jsonapi.sort.field')}
            className="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
          />

          {/* Direction toggle */}
          <button
            onClick={() => toggleDirection(sortField.id)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium border',
              sortField.direction === 'asc'
                ? 'text-green-400 border-green-800 bg-green-900/30 hover:bg-green-900/50'
                : 'text-orange-400 border-orange-800 bg-orange-900/30 hover:bg-orange-900/50'
            )}
            title={sortField.direction === 'asc' ? t('jsonapi.sort.asc') : t('jsonapi.sort.desc')}
          >
            {sortField.direction === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5" />
            )}
            {sortField.direction === 'asc' ? 'ASC' : 'DESC'}
          </button>

          {/* Move up/down */}
          <div className="flex flex-col opacity-0 group-hover:opacity-100">
            <button
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
              title={t('jsonapi.sort.moveUp')}
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => moveDown(index)}
              disabled={index === fields.length - 1}
              className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
              title={t('jsonapi.sort.moveDown')}
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={() => handleRemove(sortField.id)}
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
        {t('jsonapi.sort.addField')}
      </button>
    </div>
  )
}
