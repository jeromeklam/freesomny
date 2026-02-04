import { Plus, Trash2, GripVertical } from 'lucide-react'
import { clsx } from 'clsx'
import type { KeyValueItem } from '@api-client/shared'

interface KeyValueEditorProps {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  onBlur?: () => void
  placeholder?: string
  showDescription?: boolean
}

export function KeyValueEditor({
  items,
  onChange,
  onBlur,
  placeholder = 'Key',
  showDescription = true,
}: KeyValueEditorProps) {
  const handleAdd = () => {
    onChange([...items, { key: '', value: '', description: '', enabled: true }])
  }

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
    onBlur?.()
  }

  const handleChange = (index: number, field: keyof KeyValueItem, value: string | boolean) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    onChange(newItems)
  }

  return (
    <div className="p-4">
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase">
            <th className="w-8"></th>
            <th className="pb-2 font-medium">Key</th>
            <th className="pb-2 font-medium">Value</th>
            {showDescription && <th className="pb-2 font-medium">Description</th>}
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="group">
              <td className="py-1 pr-2">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => {
                    handleChange(index, 'enabled', e.target.checked)
                    onBlur?.()
                  }}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="text"
                  value={item.key}
                  onChange={(e) => handleChange(index, 'key', e.target.value)}
                  onBlur={onBlur}
                  placeholder={placeholder}
                  className={clsx(
                    'w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm',
                    'focus:outline-none focus:border-blue-500',
                    !item.enabled && 'opacity-50'
                  )}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => handleChange(index, 'value', e.target.value)}
                  onBlur={onBlur}
                  placeholder="Value"
                  className={clsx(
                    'w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono',
                    'focus:outline-none focus:border-blue-500',
                    !item.enabled && 'opacity-50'
                  )}
                />
              </td>
              {showDescription && (
                <td className="py-1 pr-2">
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => handleChange(index, 'description', e.target.value)}
                    onBlur={onBlur}
                    placeholder="Description"
                    className={clsx(
                      'w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-400',
                      'focus:outline-none focus:border-blue-500',
                      !item.enabled && 'opacity-50'
                    )}
                  />
                </td>
              )}
              <td className="py-1">
                <button
                  onClick={() => handleRemove(index)}
                  className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleAdd}
        className="flex items-center gap-1 mt-3 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded"
      >
        <Plus className="w-4 h-4" />
        Add {placeholder}
      </button>
    </div>
  )
}
