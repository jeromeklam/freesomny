import { useState, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useRequest, useUpdateRequest, useSendRequest } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'
import { KeyValueEditor } from './KeyValueEditor'
import { AuthEditor } from './AuthEditor'
import { BodyEditor } from './BodyEditor'
import { ScriptEditor } from './ScriptEditor'
import { ResolvedView } from './ResolvedView'
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

  const { data: requestData } = useRequest(selectedRequestId)
  const updateRequest = useUpdateRequest()
  const sendRequest = useSendRequest()
  const { t } = useTranslation()

  const [localRequest, setLocalRequest] = useState<RequestData | null>(null)

  useEffect(() => {
    if (requestData) {
      const data = requestData as RequestData
      setLocalRequest(data)
      // Update tab info when request data loads
      updateRequestTabInfo(data.id, data.name, data.method)
    } else {
      setLocalRequest(null)
    }
  }, [requestData, updateRequestTabInfo])

  const handleChange = (field: keyof RequestData, value: unknown) => {
    if (!localRequest) return
    const updated = { ...localRequest, [field]: value }
    setLocalRequest(updated)
    // Update tab info if name or method changed
    if (field === 'name' || field === 'method') {
      updateRequestTabInfo(localRequest.id, updated.name, updated.method)
    }
  }

  const handleSave = () => {
    if (!localRequest || !selectedRequestId) return
    updateRequest.mutate({ id: selectedRequestId, data: localRequest })
  }

  const handleSend = () => {
    if (!selectedRequestId) return
    // Save first, then send
    if (localRequest) {
      updateRequest.mutate(
        { id: selectedRequestId, data: localRequest },
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

        <input
          type="text"
          value={localRequest.url}
          onChange={(e) => handleChange('url', e.target.value)}
          onBlur={handleSave}
          placeholder={t('request.urlPlaceholder')}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
        />

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
          <KeyValueEditor
            items={localRequest.queryParams}
            onChange={(items) => handleChange('queryParams', items)}
            onBlur={handleSave}
            placeholder="Query parameter"
          />
        )}

        {activeTab === 'headers' && (
          <KeyValueEditor
            items={localRequest.headers}
            onChange={(items) => handleChange('headers', items)}
            onBlur={handleSave}
            placeholder="Header"
          />
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
    </div>
  )
}
