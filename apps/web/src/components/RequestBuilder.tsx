import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { hoverTooltip, type Tooltip, EditorView } from '@codemirror/view'
import { Send, Loader2, Code2, Filter, Eye, EyeOff } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useRequest, useUpdateRequest, useSendRequest, useEnvironmentVariables, useInheritedContext } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'
import { KeyValueEditor } from './KeyValueEditor'
import { AuthEditor } from './AuthEditor'
import { BodyEditor } from './BodyEditor'
import { ScriptEditor } from './ScriptEditor'
import { ResolvedView } from './ResolvedView'
import { CodeGeneratorModal } from './CodeGeneratorModal'
import { JsonApiQueryModal } from './JsonApiQueryModal'
import type { KeyValueItem, AuthType, AuthConfig } from '@api-client/shared'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-600',
  POST: 'bg-yellow-600',
  PUT: 'bg-blue-600',
  PATCH: 'bg-purple-600',
  DELETE: 'bg-red-600',
  HEAD: 'bg-gray-600',
  OPTIONS: 'bg-gray-600',
}

interface RequestData {
  id: string
  name: string
  method: string
  url: string
  headers: KeyValueItem[]
  queryParams: KeyValueItem[]
  bodyType: string
  body: string
  authType: AuthType
  authConfig: AuthConfig
  preScript: string | null
  postScript: string | null
}

export function RequestBuilder() {
  const selectedRequestId = useAppStore((s) => s.selectedRequestId)
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const isLoading = useAppStore((s) => s.isLoading)
  const clearScriptOutput = useAppStore((s) => s.clearScriptOutput)
  const updateRequestTabInfo = useAppStore((s) => s.updateRequestTabInfo)

  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)

  const { data: requestData } = useRequest(selectedRequestId)
  const { data: envVarsData } = useEnvironmentVariables(activeEnvironmentId)
  const updateRequest = useUpdateRequest()
  const sendRequest = useSendRequest()
  const { t } = useTranslation()

  const [showCodeGen, setShowCodeGen] = useState(false)
  const [showJsonApiBuilder, setShowJsonApiBuilder] = useState(false)
  const [showInherited, setShowInherited] = useState(true)

  const { data: inheritedData } = useInheritedContext(selectedRequestId)
  const inherited = inheritedData as {
    headers: Array<{ key: string; value: string; description?: string; enabled: boolean; sourceFolderName: string; sourceFolderId: string }>
    queryParams: Array<{ key: string; value: string; description?: string; enabled: boolean; sourceFolderName: string; sourceFolderId: string }>
    auth: { type: AuthType; config: AuthConfig; sourceFolderName: string; sourceFolderId: string } | null
  } | null

  // Map environment variables for tooltips
  const variablesForTooltip = useMemo(() => {
    if (!envVarsData || !Array.isArray(envVarsData)) return []
    return (envVarsData as Array<{ key: string; teamValue?: string; localValue?: string; status?: string }>).map((v) => ({
      key: v.key,
      value: v.localValue ?? v.teamValue ?? '',
      source: v.status === 'overridden' ? 'local override' : 'environment',
    }))
  }, [envVarsData])

  const variablesRef = useRef(variablesForTooltip)
  useEffect(() => { variablesRef.current = variablesForTooltip }, [variablesForTooltip])

  // URL bar extensions: variable hover tooltips + single-line styling
  const urlExtensions = useMemo(() => {
    const tooltipExt = hoverTooltip((view, pos): Tooltip | null => {
      const doc = view.state.doc
      const line = doc.lineAt(pos)
      const text = line.text
      const lineStart = line.from
      const offsetInLine = pos - lineStart

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
            const isSecret = /secret|password|token|key/i.test(varName)
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

    // Single-line theme: no wrapping, no line numbers, compact
    const singleLineTheme = EditorView.theme({
      '&': { maxHeight: '36px', fontSize: '14px' },
      '.cm-content': { padding: '6px 0', fontFamily: 'ui-monospace, monospace' },
      '.cm-line': { padding: '0' },
      '.cm-scroller': { overflow: 'hidden auto' },
    })

    // Prevent Enter from creating new lines
    const preventNewline = EditorView.domEventHandlers({
      keydown(event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          return true
        }
        return false
      },
    })

    return [tooltipExt, singleLineTheme, preventNewline]
  }, [])

  const [localRequest, setLocalRequest] = useState<RequestData | null>(null)
  const localRequestRef = useRef<RequestData | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (requestData) {
      const data = requestData as RequestData
      setLocalRequest(data)
      localRequestRef.current = data
      // Update tab info when request data loads
      updateRequestTabInfo(data.id, data.name, data.method)
    } else {
      setLocalRequest(null)
      localRequestRef.current = null
    }
  }, [requestData, updateRequestTabInfo])

  const handleChange = (field: keyof RequestData, value: unknown) => {
    if (!localRequestRef.current) return
    setLocalRequest((prev) => {
      if (!prev) return prev
      const updated = { ...prev, [field]: value }
      localRequestRef.current = updated
      if (field === 'name' || field === 'method') {
        updateRequestTabInfo(prev.id, updated.name, updated.method)
      }
      return updated
    })
  }

  // Debounced save: coalesces rapid blur+click into a single save with latest data
  const handleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const current = localRequestRef.current
      if (!current || !selectedRequestId) return
      updateRequest.mutate({ id: selectedRequestId, data: current })
    }, 0)
  }, [selectedRequestId, updateRequest])

  const handleSend = () => {
    if (!selectedRequestId) return
    const current = localRequestRef.current
    // Save first, then send
    if (current) {
      updateRequest.mutate(
        { id: selectedRequestId, data: current },
        {
          onSuccess: () => {
            clearScriptOutput()
            sendRequest.mutate(selectedRequestId)
          },
        }
      )
    } else {
      clearScriptOutput()
      sendRequest.mutate(selectedRequestId)
    }
  }

  if (!selectedRequestId || !localRequest) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>{t('request.selectRequest')}</p>
      </div>
    )
  }

  const tabs = [
    { id: 'params', label: t('request.tabs.params') },
    { id: 'headers', label: t('request.tabs.headers') },
    { id: 'auth', label: t('request.tabs.auth') },
    { id: 'body', label: t('request.tabs.body') },
    { id: 'scripts', label: t('request.tabs.scripts') },
    { id: 'resolved', label: t('request.tabs.resolved') },
  ] as const

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-700">
        <select
          value={localRequest.method}
          onChange={(e) => handleChange('method', e.target.value)}
          className={clsx(
            'px-3 py-2 rounded font-mono font-semibold text-white text-sm',
            METHOD_COLORS[localRequest.method] || 'bg-gray-600'
          )}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>

        <div className="flex-1 bg-gray-800 border border-gray-600 rounded focus-within:border-blue-500 overflow-hidden">
          <CodeMirror
            value={localRequest.url}
            onChange={(val) => handleChange('url', val)}
            onBlur={handleSave}
            placeholder={t('request.urlPlaceholder')}
            theme="dark"
            extensions={urlExtensions}
            basicSetup={false}
            className="url-editor"
          />
        </div>

        <button
          onClick={() => setShowCodeGen(true)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title={t('codegen.title')}
        >
          <Code2 className="w-4 h-4" />
        </button>

        <button
          onClick={handleSend}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded font-medium text-sm"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {t('request.send')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'params' && (
          <div>
            <div className="flex items-center justify-between px-4 pt-3">
              {inherited?.queryParams && inherited.queryParams.length > 0 ? (
                <button
                  onClick={() => setShowInherited(!showInherited)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 text-xs rounded border',
                    showInherited
                      ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                      : 'text-gray-500 border-gray-700 hover:text-gray-400'
                  )}
                  title={showInherited ? t('inherited.hideInherited') : t('inherited.showInherited')}
                >
                  {showInherited ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {t('inherited.inherited')} ({inherited.queryParams.length})
                </button>
              ) : <div />}
              <button
                onClick={() => setShowJsonApiBuilder(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800 border border-gray-700 rounded"
              >
                <Filter className="w-4 h-4" />
                {t('jsonapi.builder')}
              </button>
            </div>
            <KeyValueEditor
              items={localRequest.queryParams}
              onChange={(items) => handleChange('queryParams', items)}
              onBlur={handleSave}
              placeholder="Query parameter"
              variables={variablesForTooltip}
              inheritedItems={inherited?.queryParams}
              showInherited={showInherited}
            />
          </div>
        )}

        {activeTab === 'headers' && (
          <div>
            {inherited?.headers && inherited.headers.length > 0 && (
              <div className="flex items-center px-4 pt-3">
                <button
                  onClick={() => setShowInherited(!showInherited)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 text-xs rounded border',
                    showInherited
                      ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                      : 'text-gray-500 border-gray-700 hover:text-gray-400'
                  )}
                  title={showInherited ? t('inherited.hideInherited') : t('inherited.showInherited')}
                >
                  {showInherited ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {t('inherited.inherited')} ({inherited.headers.length})
                </button>
              </div>
            )}
            <KeyValueEditor
              items={localRequest.headers}
              onChange={(items) => handleChange('headers', items)}
              onBlur={handleSave}
              placeholder="Header"
              variables={variablesForTooltip}
              inheritedItems={inherited?.headers}
              showInherited={showInherited}
            />
          </div>
        )}

        {activeTab === 'auth' && (
          <AuthEditor
            authType={localRequest.authType}
            authConfig={localRequest.authConfig}
            onChange={(type, config) => {
              handleChange('authType', type)
              handleChange('authConfig', config)
            }}
            onBlur={handleSave}
            inheritedAuth={inherited?.auth}
          />
        )}

        {activeTab === 'body' && (
          <BodyEditor
            bodyType={localRequest.bodyType}
            body={localRequest.body}
            onChange={(type, body) => {
              handleChange('bodyType', type)
              handleChange('body', body)
            }}
            onBlur={handleSave}
            variables={variablesForTooltip}
            queryParams={localRequest.queryParams}
          />
        )}

        {activeTab === 'scripts' && (
          <ScriptEditor
            preScript={localRequest.preScript || ''}
            postScript={localRequest.postScript || ''}
            onChange={(pre, post) => {
              handleChange('preScript', pre || null)
              handleChange('postScript', post || null)
            }}
            onBlur={handleSave}
          />
        )}

        {activeTab === 'resolved' && <ResolvedView requestId={selectedRequestId} />}
      </div>

      {showCodeGen && (
        <CodeGeneratorModal
          request={localRequest}
          onClose={() => setShowCodeGen(false)}
        />
      )}

      {showJsonApiBuilder && (
        <JsonApiQueryModal
          queryParams={localRequest.queryParams}
          onApply={(params) => {
            handleChange('queryParams', params)
            handleSave()
          }}
          onClose={() => setShowJsonApiBuilder(false)}
        />
      )}
    </div>
  )
}
