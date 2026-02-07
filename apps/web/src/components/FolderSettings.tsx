import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useFolder, useUpdateFolder } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'
import { KeyValueEditor } from './KeyValueEditor'
import type { Folder, KeyValueItem, AuthType } from '@api-client/shared'

type FolderTab = 'general' | 'headers' | 'params' | 'auth' | 'scripts'

export function FolderSettings() {
  const selectedFolderId = useAppStore((s) => s.selectedFolderId)
  const { data: folderData, isLoading } = useFolder(selectedFolderId)
  const updateFolder = useUpdateFolder()
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<FolderTab>('general')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [headers, setHeaders] = useState<KeyValueItem[]>([])
  const [queryParams, setQueryParams] = useState<KeyValueItem[]>([])
  const [authType, setAuthType] = useState<AuthType>('inherit')
  const [authConfig, setAuthConfig] = useState<Record<string, string>>({})
  const [preScript, setPreScript] = useState('')
  const [postScript, setPostScript] = useState('')

  const folder = folderData as Folder | null

  const AUTH_TYPES: { value: AuthType; label: string }[] = [
    { value: 'inherit', label: t('folder.inheritAuth') },
    { value: 'none', label: t('folder.noAuth') },
    { value: 'bearer', label: t('folder.bearerToken') },
    { value: 'basic', label: t('folder.basicAuth') },
    { value: 'apikey', label: t('folder.apiKey') },
  ]

  // Sync state when folder data changes
  useEffect(() => {
    if (folder) {
      setName(folder.name || '')
      setDescription(folder.description || '')
      setBaseUrl(folder.baseUrl || '')
      setHeaders(folder.headers || [])
      setQueryParams(folder.queryParams || [])
      setAuthType(folder.authType || 'inherit')
      setAuthConfig((folder.authConfig as Record<string, string>) || {})
      setPreScript(folder.preScript || '')
      setPostScript(folder.postScript || '')
    }
  }, [folder])

  const handleSave = (field: string, value: unknown) => {
    if (!selectedFolderId) return

    updateFolder.mutate({
      id: selectedFolderId,
      data: { [field]: value },
    })
  }

  const handleNameBlur = () => {
    if (name !== folder?.name) {
      handleSave('name', name)
    }
  }

  const handleDescriptionBlur = () => {
    if (description !== folder?.description) {
      handleSave('description', description)
    }
  }

  const handleBaseUrlBlur = () => {
    if (baseUrl !== (folder?.baseUrl || '')) {
      handleSave('baseUrl', baseUrl || null)
    }
  }

  const handleHeadersChange = (newHeaders: KeyValueItem[]) => {
    setHeaders(newHeaders)
  }

  const handleHeadersBlur = () => {
    handleSave('headers', headers)
  }

  const handleParamsChange = (newParams: KeyValueItem[]) => {
    setQueryParams(newParams)
  }

  const handleParamsBlur = () => {
    handleSave('queryParams', queryParams)
  }

  const handleAuthTypeChange = (newType: AuthType) => {
    setAuthType(newType)
    handleSave('authType', newType)
  }

  const handleAuthConfigChange = (key: string, value: string) => {
    const newConfig = { ...authConfig, [key]: value }
    setAuthConfig(newConfig)
  }

  const handleAuthConfigBlur = () => {
    handleSave('authConfig', authConfig)
  }

  const handlePreScriptBlur = () => {
    if (preScript !== (folder?.preScript || '')) {
      handleSave('preScript', preScript || null)
    }
  }

  const handlePostScriptBlur = () => {
    if (postScript !== (folder?.postScript || '')) {
      handleSave('postScript', postScript || null)
    }
  }

  if (!selectedFolderId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('folder.selectFolder')}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('common.loading')}
      </div>
    )
  }

  if (!folder) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('folder.notFound')}
      </div>
    )
  }

  const tabs: { id: FolderTab; label: string }[] = [
    { id: 'general', label: t('folder.tabs.general') },
    { id: 'headers', label: t('folder.tabs.headers') },
    { id: 'params', label: t('folder.tabs.params') },
    { id: 'auth', label: t('folder.tabs.auth') },
    { id: 'scripts', label: t('folder.tabs.scripts') },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{t('folder.title')}:</span>
          <span className="font-medium">{folder.name}</span>
        </div>
        {updateFolder.isPending && (
          <span className="text-xs text-gray-500">{t('folder.saving')}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'general' && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t('folder.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t('folder.description')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                rows={3}
                placeholder={t('folder.descriptionPlaceholder')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t('folder.baseUrl')}
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onBlur={handleBaseUrlBlur}
                placeholder={t('folder.baseUrlPlaceholder')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('folder.baseUrlHelp')}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <KeyValueEditor
            items={headers}
            onChange={handleHeadersChange}
            onBlur={handleHeadersBlur}
            placeholder={t('folder.tabs.headers')}
          />
        )}

        {activeTab === 'params' && (
          <KeyValueEditor
            items={queryParams}
            onChange={handleParamsChange}
            onBlur={handleParamsBlur}
            placeholder={t('folder.tabs.params')}
          />
        )}

        {activeTab === 'auth' && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t('folder.authType')}
              </label>
              <select
                value={authType}
                onChange={(e) => handleAuthTypeChange(e.target.value as AuthType)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
              >
                {AUTH_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {authType === 'bearer' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  {t('auth.token')}
                </label>
                <input
                  type="text"
                  value={authConfig.token || ''}
                  onChange={(e) => handleAuthConfigChange('token', e.target.value)}
                  onBlur={handleAuthConfigBlur}
                  placeholder="{{token}}"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {authType === 'basic' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.username')}
                  </label>
                  <input
                    type="text"
                    value={authConfig.username || ''}
                    onChange={(e) => handleAuthConfigChange('username', e.target.value)}
                    onBlur={handleAuthConfigBlur}
                    placeholder="{{username}}"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.password')}
                  </label>
                  <input
                    type="password"
                    value={authConfig.password || ''}
                    onChange={(e) => handleAuthConfigChange('password', e.target.value)}
                    onBlur={handleAuthConfigBlur}
                    placeholder="{{password}}"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {authType === 'apikey' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.keyName')}
                  </label>
                  <input
                    type="text"
                    value={authConfig.key || ''}
                    onChange={(e) => handleAuthConfigChange('key', e.target.value)}
                    onBlur={handleAuthConfigBlur}
                    placeholder="X-API-Key"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('common.value')}
                  </label>
                  <input
                    type="text"
                    value={authConfig.value || ''}
                    onChange={(e) => handleAuthConfigChange('value', e.target.value)}
                    onBlur={handleAuthConfigBlur}
                    placeholder="{{api_key}}"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.addTo')}
                  </label>
                  <select
                    value={authConfig.addTo || 'header'}
                    onChange={(e) => {
                      handleAuthConfigChange('addTo', e.target.value)
                      handleAuthConfigBlur()
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="header">{t('auth.header')}</option>
                    <option value="query">{t('auth.queryParameter')}</option>
                    <option value="cookie">{t('auth.cookie')}</option>
                  </select>
                </div>
              </>
            )}

            {authType === 'inherit' && (
              <p className="text-sm text-gray-500">
                {t('folder.inheritAuthHelp')}
              </p>
            )}

            {authType === 'none' && (
              <p className="text-sm text-gray-500">
                {t('folder.noAuthHelp')}
              </p>
            )}
          </div>
        )}

        {activeTab === 'scripts' && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t('folder.preScript')}
              </label>
              <textarea
                value={preScript}
                onChange={(e) => setPreScript(e.target.value)}
                onBlur={handlePreScriptBlur}
                rows={8}
                placeholder={t('folder.preScriptPlaceholder')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t('folder.postScript')}
              </label>
              <textarea
                value={postScript}
                onChange={(e) => setPostScript(e.target.value)}
                onBlur={handlePostScriptBlur}
                rows={8}
                placeholder={t('folder.postScriptPlaceholder')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
