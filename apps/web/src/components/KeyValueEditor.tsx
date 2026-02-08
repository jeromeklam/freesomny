import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import type { KeyValueItem } from '@api-client/shared'
import { useTranslation } from '../hooks/useTranslation'

interface VariableInfo {
  key: string
  value: string
  source?: string
}

export interface InheritedKeyValueItem {
  key: string
  value: string
  description?: string
  enabled: boolean
  sourceFolderName: string
  sourceFolderId: string
}

interface KeyValueEditorProps {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  onBlur?: () => void
  placeholder?: string
  showDescription?: boolean
  variables?: VariableInfo[]
  inheritedItems?: InheritedKeyValueItem[]
  showInherited?: boolean
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
  inheritedItems = [],
  showInherited = false,
}: KeyValueEditorProps) {
  const { t } = useTranslation()

  // Compute duplicate key warnings: keys marked singleKey that appear more than once
  const duplicateKeys = new Set<string>()
  const keyCounts = new Map<string, { count: number; hasSingle: boolean }>()
  for (const item of items) {
    if (!item.enabled || !item.key) continue
    const lower = item.key.toLowerCase()
    const existing = keyCounts.get(lower)
    if (existing) {
      existing.count++
      if (item.singleKey) existing.hasSingle = true
    } else {
      keyCounts.set(lower, { count: 1, hasSingle: !!item.singleKey })
    }
  }
  for (const [key, { count, hasSingle }] of keyCounts) {
    if (count > 1 && hasSingle) duplicateKeys.add(key)
  }

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
          {/* Inherited items from parent folders */}
          {showInherited && inheritedItems.length > 0 && (
            <>
              {inheritedItems.map((item, index) => (
                <tr key={`inherited-${index}`} className="opacity-50">
                  <td className="py-1 pr-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      disabled
                      className="w-4 h-4 rounded bg-gray-700 border-gray-600 cursor-not-allowed"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={item.key}
                      disabled
                      className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-sm text-gray-500 cursor-not-allowed"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={item.value}
                      disabled
                      className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-sm font-mono text-gray-500 cursor-not-allowed"
                    />
                  </td>
                  {showDescription && (
                    <td className="py-1 pr-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-gray-700/60 text-gray-400 rounded">
                        {item.sourceFolderName}
                      </span>
                    </td>
                  )}
                  <td className="py-1">
                    {/* No delete button for inherited items */}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={showDescription ? 5 : 4}>
                  <div className="border-b border-dashed border-gray-700 my-1" />
                </td>
              </tr>
            </>
          )}

          {/* Editable items */}
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
                <div className="flex items-center">
                  {item.key && item.enabled && duplicateKeys.has(item.key.toLowerCase()) && (
                    <span className="p-1 text-yellow-500" title={t('keyValue.duplicateWarning')}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const newItems = [...items]
                      newItems[index] = { ...newItems[index], singleKey: !newItems[index].singleKey }
                      onChange(newItems)
                      onBlur?.()
                    }}
                    className={clsx(
                      'p-1 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity',
                      item.singleKey
                        ? 'text-blue-400'
                        : 'text-gray-600 hover:text-gray-400'
                    )}
                    title={item.singleKey ? t('keyValue.singleKey') : t('keyValue.multipleKeys')}
                  >
                    {item.singleKey ? '1' : 'N'}
                  </button>
                  <button
                    onClick={() => handleRemove(index)}
                    className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
