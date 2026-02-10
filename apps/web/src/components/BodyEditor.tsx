import { useMemo, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { hoverTooltip, type Tooltip } from '@codemirror/view'
import { clsx } from 'clsx'
import { AlertTriangle, CheckCircle, XCircle, Wand2 } from 'lucide-react'
import { BODY_TYPES } from '@api-client/shared'
import type { KeyValueItem } from '@api-client/shared'
import { useTranslation } from '../hooks/useTranslation'

interface VariableInfo {
  key: string
  value: string
  source?: string
}

interface BodyEditorProps {
  bodyType: string
  body: string
  onChange: (type: string, body: string) => void
  onBlur?: () => void
  variables?: VariableInfo[]
  queryParams?: KeyValueItem[]
}

// Validate JSON syntax — returns error message or null if valid
function validateJson(body: string): string | null {
  if (!body.trim()) return null
  try {
    JSON.parse(body)
    return null
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON'
    return msg
  }
}

// Validate JSON:API structure per jsonapi.org spec
function validateJsonApi(body: string): string[] {
  if (!body.trim()) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return []  // JSON syntax error handled separately
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return ['Top-level must be a JSON object']
  }

  const obj = parsed as Record<string, unknown>
  const warnings: string[] = []

  // Must have at least one of: data, errors, meta
  const hasData = 'data' in obj
  const hasErrors = 'errors' in obj
  const hasMeta = 'meta' in obj

  if (!hasData && !hasErrors && !hasMeta) {
    warnings.push("Must contain 'data', 'errors', or 'meta'")
  }

  // data and errors must NOT coexist
  if (hasData && hasErrors) {
    warnings.push("'data' and 'errors' must not coexist")
  }

  // If data is an object, it should have type
  if (hasData && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data)) {
    const data = obj.data as Record<string, unknown>
    if (!('type' in data) || typeof data.type !== 'string') {
      warnings.push("'data' object should have a 'type' string")
    }
  }

  // If data is an array, each item should have type
  if (hasData && Array.isArray(obj.data)) {
    for (let i = 0; i < (obj.data as unknown[]).length; i++) {
      const item = (obj.data as unknown[])[i]
      if (typeof item === 'object' && item !== null) {
        const resource = item as Record<string, unknown>
        if (!('type' in resource) || typeof resource.type !== 'string') {
          warnings.push(`data[${i}] should have a 'type' string`)
          break
        }
      }
    }
  }

  // included requires data
  if ('included' in obj && !hasData) {
    warnings.push("'included' requires 'data' to be present")
  }

  return warnings
}

// Generate a JSON:API body skeleton from query params
function generateJsonApiSkeleton(queryParams: KeyValueItem[]): string | null {
  const attributes = new Set<string>()
  const relationships = new Set<string>()
  let resourceType = ''

  for (const p of queryParams) {
    // Extract field names from filter[field] or filter[field][op]
    const filterMatch = p.key.match(/^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/)
    if (filterMatch && filterMatch[1] !== 'or') {
      attributes.add(filterMatch[1])
      continue
    }

    // Extract field names from OR filters: filter[or][N][field][op]
    const orFilterMatch = p.key.match(/^filter\[or\]\[\d+\]\[([^\]]+)\]/)
    if (orFilterMatch) {
      attributes.add(orFilterMatch[1])
      continue
    }

    // Extract field names from sort
    if (p.key === 'sort' && p.value) {
      for (const part of p.value.split(',')) {
        const field = part.trim().replace(/^[-+]/, '')
        if (field) attributes.add(field)
      }
      continue
    }

    // Extract relations from include
    if (p.key === 'include' && p.value) {
      for (const rel of p.value.split(',')) {
        const name = rel.trim()
        if (name) relationships.add(name)
      }
      continue
    }

    // Extract fields from fields[type]=field1,field2
    const fieldsMatch = p.key.match(/^fields\[([^\]]+)\]$/)
    if (fieldsMatch) {
      if (!resourceType) resourceType = fieldsMatch[1]
      for (const f of p.value.split(',')) {
        const name = f.trim()
        if (name) attributes.add(name)
      }
    }
  }

  if (attributes.size === 0 && relationships.size === 0) return null

  const skeleton: Record<string, unknown> = {
    data: {
      type: resourceType || '',
      ...(attributes.size > 0
        ? { attributes: Object.fromEntries([...attributes].map((a) => [a, ''])) }
        : {}),
      ...(relationships.size > 0
        ? {
            relationships: Object.fromEntries(
              [...relationships].map((r) => [r, { data: { type: '', id: '' } }])
            ),
          }
        : {}),
    },
  }

  return JSON.stringify(skeleton, null, 2)
}

export function BodyEditor({ bodyType, body, onChange, onBlur, variables = [], queryParams = [] }: BodyEditorProps) {
  const { t } = useTranslation()
  const variablesRef = useRef<VariableInfo[]>(variables)

  useEffect(() => {
    variablesRef.current = variables
  }, [variables])

  const handleTypeChange = (type: string) => {
    onChange(type, body)
    onBlur?.()
  }

  const handleBodyChange = (value: string) => {
    onChange(bodyType, value)
  }

  const formatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(body), null, 2)
      onChange(bodyType, formatted)
      onBlur?.()
    } catch {
      // Invalid JSON, don't format
    }
  }

  const handleGenerateSkeleton = () => {
    const skeleton = generateJsonApiSkeleton(queryParams)
    if (!skeleton) return
    if (body.trim() && !confirm(t('body.generateSkeletonConfirm'))) return
    onChange(bodyType, skeleton)
    onBlur?.()
  }

  const canGenerateSkeleton = bodyType === 'jsonapi' && queryParams.length > 0
  const skeletonAvailable = canGenerateSkeleton && generateJsonApiSkeleton(queryParams) !== null

  const isJsonType = bodyType === 'json' || bodyType === 'jsonapi'

  // JSON syntax validation (memoized)
  const jsonError = useMemo(() => {
    if (!isJsonType || !body.trim()) return null
    return validateJson(body)
  }, [isJsonType, body])

  // JSON:API structure warnings (memoized)
  const jsonApiWarnings = useMemo(() => {
    if (bodyType !== 'jsonapi' || !body.trim()) return []
    return validateJsonApi(body)
  }, [bodyType, body])

  // CodeMirror extension for variable hover tooltips
  const variableTooltipExt = useMemo(() => {
    return hoverTooltip((view, pos): Tooltip | null => {
      const doc = view.state.doc
      const line = doc.lineAt(pos)
      const text = line.text
      const lineStart = line.from
      const offsetInLine = pos - lineStart

      // Find {{variable}} pattern at cursor position
      const pattern = /\{\{([^}]+)\}\}/g
      let match
      while ((match = pattern.exec(text)) !== null) {
        const start = match.index
        const end = start + match[0].length
        if (offsetInLine >= start && offsetInLine <= end) {
          const varName = match[1].trim()
          const vars = variablesRef.current
          const found = vars.find((v) => v.key === varName)

          const dom = document.createElement('div')
          dom.className = 'cm-variable-tooltip'

          if (found) {
            const isSecret = varName.toLowerCase().includes('secret') ||
                            varName.toLowerCase().includes('password') ||
                            varName.toLowerCase().includes('token') ||
                            varName.toLowerCase().includes('key')

            dom.innerHTML = `<div style="padding:4px 8px;font-size:12px;font-family:monospace;">` +
              `<div style="color:#93c5fd;margin-bottom:2px;">${varName}</div>` +
              `<div style="color:#d1d5db;">${isSecret ? '••••••••' : found.value || '<empty>'}</div>` +
              (found.source ? `<div style="color:#9ca3af;font-size:10px;margin-top:2px;">${found.source}</div>` : '') +
              `</div>`
          } else {
            dom.innerHTML = `<div style="padding:4px 8px;font-size:12px;font-family:monospace;">` +
              `<div style="color:#fbbf24;">${varName}</div>` +
              `<div style="color:#f87171;">undefined</div>` +
              `</div>`
          }

          return {
            pos: lineStart + start,
            end: lineStart + end,
            above: true,
            create: () => ({ dom }),
          }
        }
      }
      return null
    })
  }, []) // stable — reads from ref

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-3 border-b border-gray-200 dark:border-gray-700">
        {Object.entries(BODY_TYPES).map(([value, { label }]) => (
          <label key={value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bodyType"
              value={value}
              checked={bodyType === value}
              onChange={() => handleTypeChange(value)}
              className="w-4 h-4 text-blue-600 bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
            <span className={clsx('text-sm', bodyType === value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>
              {label}
            </span>
          </label>
        ))}

        {isJsonType && (
          <>
            <div className="ml-auto flex items-center gap-2">
              {body.trim() && (
                jsonError ? (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    {t('body.invalidJson')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t('body.validJson')}
                  </span>
                )
              )}
              <button
                onClick={formatJson}
                disabled={!!jsonError}
                className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('body.format')}
              </button>
              {skeletonAvailable && (
                <button
                  onClick={handleGenerateSkeleton}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-800 rounded hover:border-purple-600"
                  title={t('body.generateSkeleton')}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {t('body.generateSkeleton')}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* JSON syntax error details */}
      {isJsonType && jsonError && body.trim() && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-900/20 border-b border-red-800/30 text-red-400 text-xs">
          <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div className="font-mono">{jsonError}</div>
        </div>
      )}

      {/* JSON:API structure warnings */}
      {bodyType === 'jsonapi' && !jsonError && jsonApiWarnings.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-yellow-900/20 border-b border-yellow-800/30 text-yellow-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">JSON:API: </span>
            {jsonApiWarnings.join('; ')}
          </div>
        </div>
      )}

      {bodyType === 'none' ? (
        <div className="flex items-center justify-center flex-1 text-gray-500">
          <p>{t('body.noBody')}</p>
        </div>
      ) : isJsonType ? (
        <div className="flex-1 overflow-auto">
          <CodeMirror
            value={body}
            height="100%"
            theme="dark"
            extensions={[json(), variableTooltipExt]}
            onChange={handleBodyChange}
            onBlur={onBlur}
            className="h-full"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
            }}
          />
        </div>
      ) : (
        <div className="flex-1 p-3">
          <textarea
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onBlur={onBlur}
            placeholder={
              bodyType === 'raw'
                ? t('body.enterRaw')
                : bodyType === 'urlencoded'
                ? t('body.enterUrlencoded')
                : t('body.enterContent')
            }
            className="w-full h-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono resize-none focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
    </div>
  )
}
