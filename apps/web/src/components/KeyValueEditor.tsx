import { Plus, Trash2, GripVertical } from 'lucide-react'
import { clsx } from 'clsx'
import type { KeyValueItem } from '@api-client/shared'
import { useTranslation } from '../hooks/useTranslation'

interface VariableInfo {
  key: string
  value: string
  source?: string
}

interface KeyValueEditorProps {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  onBlur?: () => void
  placeholder?: string
  showDescription?: boolean
  variables?: VariableInfo[]
}

// Resolve {{VAR}} patterns and return segments for rendering
function resolveText(text: string, variables: VariableInfo[]): { hasVars: boolean; resolved: string; segments: Array<{ text: string; type: 'text' | 'resolved' | 'undefined'; source?: string }> } {
  const pattern = /\{\{([^}]+)\}\}/g
  const segments: Array<{ text: string; type: 'text' | 'resolved' | 'undefined'; source?: string }> = []
  let lastIndex = 0
  let match
  let hasVars = false

  while ((match = pattern.exec(text)) !== null) {
    hasVars = true
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), type: 'text' })
    }
    const varName = match[1].trim()
    const found = variables.find((v) => v.key === varName)
    const isSecret = /secret|password|token|key/i.test(varName)
    if (found) {
      segments.push({ text: isSecret ? '••••••••' : (found.value || '<empty>'), type: 'resolved', source: found.source })
    } else {
      segments.push({ text: `{{${varName}}}`, type: 'undefined' })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), type: 'text' })
  }

  const resolved = segments.map((s) => s.text).join('')
  return { hasVars, resolved, segments }
}

function VariablePreview({ text, variables }: { text: string; variables: VariableInfo[] }) {
  if (!text || !text.includes('{{')) return null
  const { hasVars, segments } = resolveText(text, variables)
  if (!hasVars) return null

  return (
    <div className="mt-0.5 px-1 text-[10px] font-mono leading-tight truncate" title={segments.map((s) => s.text).join('')}>
      {segments.map((seg, i) => (
        <span
          key={i}
          className={clsx(
            seg.type === 'resolved' && 'text-green-400',
            seg.type === 'undefined' && 'text-red-400',
            seg.type === 'text' && 'text-gray-500'
          )}
          title={seg.type === 'resolved' && seg.source ? `${seg.source}` : undefined}
        >
          {seg.text}
        </span>
      ))}
    </div>
  )
}

export function KeyValueEditor({
  items,
  onChange,
  onBlur,
  placeholder = 'Key',
  showDescription = true,
  variables = [],
}: KeyValueEditorProps) {
  const { t } = useTranslation()

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
            <th className="pb-2 font-medium">{t('keyValue.key')}</th>
            <th className="pb-2 font-medium">{t('keyValue.value')}</th>
            {showDescription && <th className="pb-2 font-medium">{t('keyValue.description')}</th>}
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
                {variables.length > 0 && <VariablePreview text={item.key} variables={variables} />}
              </td>
              <td className="py-1 pr-2">
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => handleChange(index, 'value', e.target.value)}
                  onBlur={onBlur}
                  placeholder={t('keyValue.value')}
                  className={clsx(
                    'w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono',
                    'focus:outline-none focus:border-blue-500',
                    !item.enabled && 'opacity-50'
                  )}
                />
                {variables.length > 0 && <VariablePreview text={item.value} variables={variables} />}
              </td>
              {showDescription && (
                <td className="py-1 pr-2">
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => handleChange(index, 'description', e.target.value)}
                    onBlur={onBlur}
                    placeholder={t('keyValue.description')}
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
        {t('keyValue.add')} {placeholder}
      </button>
    </div>
  )
}
