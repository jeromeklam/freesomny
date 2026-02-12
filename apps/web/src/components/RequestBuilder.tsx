import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { hoverTooltip, type Tooltip, EditorView, ViewPlugin, Decoration, type DecorationSet, type ViewUpdate, WidgetType } from '@codemirror/view'
import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import { Send, Loader2, Code2, Filter, Eye, EyeOff, Server, Globe, Laptop, ChevronDown, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useRequest, useUpdateRequest, useSendRequest, useEnvironmentVariables, useInheritedContext, useAgents } from '../hooks/useApi'
import type { SendMode } from '@api-client/shared'
import { useTranslation } from '../hooks/useTranslation'
import { KeyValueEditor } from './KeyValueEditor'
import { AuthEditor } from './AuthEditor'
import { BodyEditor } from './BodyEditor'
import { ScriptEditor } from './ScriptEditor'
import { ResolvedView } from './ResolvedView'
import { CodeGeneratorModal } from './CodeGeneratorModal'
import { JsonApiQueryModal } from './JsonApiQueryModal'
import type { KeyValueItem, AuthType, AuthConfig, AuthBearer, AuthBasic, AuthApiKey, AuthJwtFreefw, AuthOAuth2, AuthOpenId } from '@api-client/shared'

// Preview the Authorization header value from auth config (client-side)
function getAuthHeaderPreview(authType: AuthType, authConfig: AuthConfig): { key: string; value: string } | null {
  switch (authType) {
    case 'bearer': {
      const config = authConfig as AuthBearer
      return config.token ? { key: 'Authorization', value: `Bearer ${config.token}` } : null
    }
    case 'basic': {
      const config = authConfig as AuthBasic
      if (config.username !== undefined) {
        return { key: 'Authorization', value: `Basic ${btoa(`${config.username}:${config.password || ''}`)}` }
      }
      return null
    }
    case 'jwt_freefw': {
      const config = authConfig as AuthJwtFreefw
      return config.token ? { key: 'Authorization', value: `JWT id="${config.token}"` } : null
    }
    case 'apikey': {
      const config = authConfig as AuthApiKey
      if (config.key && config.value && config.addTo === 'header') {
        return { key: config.key, value: config.value }
      }
      return null
    }
    case 'oauth2': {
      const config = authConfig as AuthOAuth2
      if (config.accessToken) {
        const prefix = config.headerPrefix || 'Bearer'
        return { key: 'Authorization', value: `${prefix} ${config.accessToken}` }
      }
      return null
    }
    case 'openid': {
      const config = authConfig as AuthOpenId
      if (config.accessToken) {
        const prefix = config.tokenPrefix || 'Bearer'
        return { key: 'Authorization', value: `${prefix} ${config.accessToken}` }
      }
      return null
    }
    default:
      return null
  }
}

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
  description: string
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

  const sendMode = useAppStore((s) => s.sendMode)
  const setSendMode = useAppStore((s) => s.setSendMode)
  const selectedAgentId = useAppStore((s) => s.selectedAgentId)
  const setSelectedAgentId = useAppStore((s) => s.setSelectedAgentId)

  const { data: agentsData } = useAgents()
  const agents = agentsData as Array<{ id: string; name: string; connectedAt: string; lastHeartbeat: string }> | undefined

  const [showCodeGen, setShowCodeGen] = useState(false)
  const [showJsonApiBuilder, setShowJsonApiBuilder] = useState(false)
  const [showInherited, setShowInherited] = useState(true)
  const [showSendModeMenu, setShowSendModeMenu] = useState(false)
  const [showDescription, setShowDescription] = useState(false)

  const { data: inheritedData } = useInheritedContext(selectedRequestId)
  const inherited = inheritedData as {
    headers: Array<{ key: string; value: string; description?: string; enabled: boolean; sourceFolderName: string; sourceFolderId: string }>
    queryParams: Array<{ key: string; value: string; description?: string; enabled: boolean; sourceFolderName: string; sourceFolderId: string }>
    auth: { type: AuthType; config: AuthConfig; sourceFolderName: string; sourceFolderId: string } | null
  } | null

  // Map environment variables for tooltips
  const variablesForTooltip = useMemo(() => {
    if (!envVarsData) return []
    // Support both legacy array format and new { variables, canEditProtected } format
    const vars = Array.isArray(envVarsData) ? envVarsData : (envVarsData as { variables?: unknown[] }).variables
    if (!Array.isArray(vars)) return []
    return (vars as Array<{ key: string; teamValue?: string; localValue?: string; status?: string; isSecret?: boolean }>).map((v) => ({
      key: v.key,
      value: v.localValue ?? v.teamValue ?? '',
      source: v.status === 'overridden' ? 'local override' : 'environment',
      isSecret: v.isSecret,
    }))
  }, [envVarsData])

  const variablesRef = useRef(variablesForTooltip)
  const urlEditorRef = useRef<EditorView | null>(null)
  const variablesChangedEffect = useMemo(() => StateEffect.define<null>(), [])
  useEffect(() => {
    variablesRef.current = variablesForTooltip
    // Force CodeMirror to rebuild variable decorations
    if (urlEditorRef.current) {
      urlEditorRef.current.dispatch({ effects: variablesChangedEffect.of(null) })
    }
  }, [variablesForTooltip, variablesChangedEffect])

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
            const isSecret = found.isSecret || /secret|password|token|key/i.test(varName)
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

    // Inline variable highlighting: green for resolved, red for undefined
    // When unfocused: resolved vars are replaced with their actual values (green)
    // When focused: show raw {{var}} with green/red coloring
    const varResolved = Decoration.mark({ class: 'cm-var-resolved' })
    const varUndefined = Decoration.mark({ class: 'cm-var-undefined' })

    class ResolvedVarWidget extends WidgetType {
      constructor(readonly value: string, readonly isSecret: boolean) { super() }
      toDOM() {
        const span = document.createElement('span')
        span.className = 'cm-var-resolved'
        span.textContent = this.isSecret ? '••••••' : this.value
        return span
      }
      eq(other: ResolvedVarWidget) { return this.value === other.value && this.isSecret === other.isSecret }
    }

    function buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const doc = view.state.doc
      const hasFocus = view.hasFocus
      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i)
        const pattern = /\{\{([^}]+)\}\}/g
        let m
        while ((m = pattern.exec(line.text)) !== null) {
          const varName = m[1].trim()
          const vars = variablesRef.current
          const found = vars.find((v) => v.key === varName)
          const from = line.from + m.index
          const to = line.from + m.index + m[0].length
          if (found && !hasFocus) {
            // Unfocused + resolved: replace {{var}} with the actual value
            const isSecret = found.isSecret || /secret|password|token|key/i.test(varName)
            builder.add(from, to, Decoration.replace({ widget: new ResolvedVarWidget(found.value || varName, isSecret) }))
          } else {
            // Focused or undefined: mark with green/red
            builder.add(from, to, found ? varResolved : varUndefined)
          }
        }
      }
      return builder.finish()
    }

    const varHighlightPlugin = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = buildDecorations(view)
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged || update.focusChanged || update.transactions.some(tr => tr.effects.some(e => e.is(variablesChangedEffect)))) {
            this.decorations = buildDecorations(update.view)
          }
        }
      },
      { decorations: (v) => v.decorations }
    )

    // Single-line theme: no wrapping, no line numbers, compact
    const singleLineTheme = EditorView.theme({
      '&': { maxHeight: '36px', fontSize: '14px' },
      '.cm-content': { padding: '6px 0', fontFamily: 'ui-monospace, monospace' },
      '.cm-line': { padding: '0' },
      '.cm-scroller': { overflow: 'hidden auto' },
      '.cm-var-resolved': { color: '#4ade80', fontWeight: '500' },
      '.cm-var-undefined': { color: '#f87171', fontWeight: '500' },
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

    return [tooltipExt, varHighlightPlugin, singleLineTheme, preventNewline]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variablesChangedEffect])

  const [localRequest, setLocalRequest] = useState<RequestData | null>(null)
  const localRequestRef = useRef<RequestData | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Compute inherited headers including auth-generated Authorization
  // Backend provides auth header for inherited auth from parent folders.
  // If the request itself has auth configured, add it client-side.
  const inheritedHeaders = useMemo(() => {
    const base = inherited?.headers || []
    if (!localRequest) return base
    // When auth is 'none', suppress inherited auth headers — user manages Authorization manually
    if (localRequest.authType === 'none') {
      return base.filter(h => !h.sourceFolderName.startsWith('auth:'))
    }
    // If request has its own auth (not inherit) AND backend didn't already add it
    if (localRequest.authType !== 'inherit') {
      const authHeader = getAuthHeaderPreview(localRequest.authType, localRequest.authConfig)
      if (authHeader) {
        const alreadyHas = base.some(h => h.key.toLowerCase() === authHeader.key.toLowerCase() && h.sourceFolderName.startsWith('auth:'))
        if (!alreadyHas) {
          return [...base, {
            key: authHeader.key,
            value: authHeader.value,
            description: undefined,
            enabled: true,
            sourceFolderName: 'auth:request',
            sourceFolderId: localRequest.id,
          }]
        }
      }
    }
    return base
  }, [inherited?.headers, localRequest?.authType, localRequest?.authConfig, localRequest?.id])

  useEffect(() => {
    if (requestData) {
      const data = requestData as RequestData
      setLocalRequest(data)
      localRequestRef.current = data
      updateRequestTabInfo(data.id, data.name, data.method)
      // Auto-show description if it has content
      if (data.description) setShowDescription(true)
      else setShowDescription(false)
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
      // Strip empty key-value items before saving
      const cleaned = {
        ...current,
        headers: current.headers?.filter((h: { key: string; value: string }) => h.key || h.value),
        queryParams: current.queryParams?.filter((p: { key: string; value: string }) => p.key || p.value),
      }
      localRequestRef.current = cleaned
      updateRequest.mutate({ id: selectedRequestId, data: cleaned })
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
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
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

        <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus-within:border-blue-500 overflow-hidden">
          <CodeMirror
            value={localRequest.url}
            onChange={(val) => handleChange('url', val)}
            onBlur={handleSave}
            onCreateEditor={(view) => { urlEditorRef.current = view }}
            placeholder={t('request.urlPlaceholder')}
            theme="dark"
            extensions={urlExtensions}
            basicSetup={false}
            className="url-editor"
          />
        </div>

        <button
          onClick={() => setShowDescription(!showDescription)}
          className={clsx(
            'p-2 rounded',
            showDescription || localRequest.description
              ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
          title={t('request.description')}
        >
          <FileText className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowCodeGen(true)}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title={t('codegen.title')}
        >
          <Code2 className="w-4 h-4" />
        </button>

        <div className="relative flex items-center">
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-l font-medium text-sm"
            title={sendMode === 'browser' ? t('sendMode.browser') : sendMode === 'agent' ? t('sendMode.agent') : t('sendMode.server')}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sendMode === 'browser' ? (
              <Globe className="w-4 h-4" />
            ) : sendMode === 'agent' ? (
              <Laptop className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('request.send')}
          </button>
          <button
            onClick={() => setShowSendModeMenu(!showSendModeMenu)}
            className="flex items-center px-1.5 self-stretch bg-blue-600 hover:bg-blue-700 text-white rounded-r border-l border-blue-500"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSendModeMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50 w-64">
              <button
                onClick={() => { setSendMode('server'); setShowSendModeMenu(false) }}
                className={clsx(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700',
                  sendMode === 'server' && 'text-blue-400'
                )}
              >
                <Server className="w-4 h-4 shrink-0" />
                <div>
                  <div>{t('sendMode.server')}</div>
                  <div className="text-xs text-gray-500">{t('sendMode.serverDesc')}</div>
                </div>
              </button>
              <button
                onClick={() => { setSendMode('browser'); setShowSendModeMenu(false) }}
                className={clsx(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700',
                  sendMode === 'browser' && 'text-blue-400'
                )}
              >
                <Globe className="w-4 h-4 shrink-0" />
                <div>
                  <div>{t('sendMode.browser')}</div>
                  <div className="text-xs text-gray-500">{t('sendMode.browserDesc')}</div>
                </div>
              </button>
              <button
                onClick={() => { setSendMode('agent'); setShowSendModeMenu(false) }}
                className={clsx(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700',
                  sendMode === 'agent' && 'text-blue-400'
                )}
              >
                <Laptop className="w-4 h-4 shrink-0" />
                <div>
                  <div>{t('sendMode.agent')}</div>
                  <div className="text-xs text-gray-500">{t('sendMode.agentDesc')}</div>
                </div>
              </button>
              {sendMode === 'browser' && (
                <div className="px-3 py-2 text-xs text-yellow-400 border-t border-gray-200 dark:border-gray-700">
                  {t('sendMode.corsWarning')}
                </div>
              )}
              {sendMode === 'agent' && (
                <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                  {agents && agents.length > 0 ? (
                    <>
                      <div className="px-3 py-1 text-xs text-gray-500">{t('sendMode.selectAgent')}</div>
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => { setSelectedAgentId(agent.id); setShowSendModeMenu(false) }}
                          className={clsx(
                            'flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-700',
                            selectedAgentId === agent.id && 'text-green-400'
                          )}
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          {agent.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-3 py-2 text-xs text-yellow-400">
                      {t('sendMode.noAgents')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {showDescription && (
        <div className="px-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          <textarea
            value={localRequest.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            onBlur={handleSave}
            placeholder={t('request.descriptionPlaceholder')}
            rows={2}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 resize-y focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
                      : 'text-gray-500 border-gray-200 dark:border-gray-700 hover:text-gray-500 dark:hover:text-gray-400'
                  )}
                  title={showInherited ? t('inherited.hideInherited') : t('inherited.showInherited')}
                >
                  {showInherited ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {t('inherited.inherited')} ({inherited.queryParams.length})
                </button>
              ) : <div />}
              <button
                onClick={() => setShowJsonApiBuilder(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
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
            {inheritedHeaders.length > 0 && (
              <div className="flex items-center px-4 pt-3">
                <button
                  onClick={() => setShowInherited(!showInherited)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 text-xs rounded border',
                    showInherited
                      ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                      : 'text-gray-500 border-gray-200 dark:border-gray-700 hover:text-gray-500 dark:hover:text-gray-400'
                  )}
                  title={showInherited ? t('inherited.hideInherited') : t('inherited.showInherited')}
                >
                  {showInherited ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {t('inherited.inherited')} ({inheritedHeaders.length})
                </button>
              </div>
            )}
            <KeyValueEditor
              items={localRequest.headers}
              onChange={(items) => handleChange('headers', items)}
              onBlur={handleSave}
              placeholder="Header"
              variables={variablesForTooltip}
              inheritedItems={inheritedHeaders}
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
          inheritedHeaders={inheritedHeaders}
          inheritedAuth={inherited?.auth || null}
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
