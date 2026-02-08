import { useState, useEffect, useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../stores/app'
import { useFolder, useUpdateFolder, useFolderInheritedContext, useEnvironmentVariables } from '../hooks/useApi'
import { useTranslation } from '../hooks/useTranslation'
import { KeyValueEditor } from './KeyValueEditor'
import type { Folder, KeyValueItem, AuthType, AuthConfig, AuthBearer, AuthBasic, AuthApiKey, AuthJwtFreefw, AuthOAuth2, AuthOpenId } from '@api-client/shared'
import { JWT_ALGORITHMS, AUTH_TYPES as SHARED_AUTH_TYPES } from '@api-client/shared'

// Preview the Authorization header value from auth config (client-side)
function getAuthHeaderPreviewClient(authType: AuthType, authConfig: AuthConfig): { key: string; value: string } | null {
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

type FolderTab = 'general' | 'headers' | 'params' | 'auth' | 'scripts'

export function FolderSettings() {
  const selectedFolderId = useAppStore((s) => s.selectedFolderId)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const { data: folderData, isLoading } = useFolder(selectedFolderId)
  const updateFolder = useUpdateFolder()
  const { data: inheritedData } = useFolderInheritedContext(selectedFolderId)
  const { data: envVarsData } = useEnvironmentVariables(activeEnvironmentId)
  const { t } = useTranslation()

  const variablesForTooltip = useMemo(() => {
    if (!envVarsData || !Array.isArray(envVarsData)) return []
    return (envVarsData as Array<{ key: string; teamValue?: string; localValue?: string; status?: string }>).map((v) => ({
      key: v.key,
      value: v.localValue ?? v.teamValue ?? '',
      source: v.status === 'overridden' ? 'local override' : 'environment',
    }))
  }, [envVarsData])

  const inherited = inheritedData as {
    headers: Array<{ key: string; value: string; description?: string; enabled: boolean; sourceFolderName: string; sourceFolderId: string }>
    queryParams: Array<{ key: string; value: string; description?: string; enabled: boolean; sourceFolderName: string; sourceFolderId: string }>
    auth: { type: AuthType; config: AuthConfig; sourceFolderName: string; sourceFolderId: string } | null
  } | null

  const [activeTab, setActiveTab] = useState<FolderTab>('general')
  const [showInherited, setShowInherited] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [headers, setHeaders] = useState<KeyValueItem[]>([])
  const [queryParams, setQueryParams] = useState<KeyValueItem[]>([])
  const [authType, setAuthType] = useState<AuthType>('inherit')
  const [authConfig, setAuthConfig] = useState<Record<string, string>>({})
  const [preScript, setPreScript] = useState('')
  const [postScript, setPostScript] = useState('')

  // Compute inherited headers: backend provides auth-generated header from ancestor folders.
  // If folder itself has auth configured, add it client-side.
  const inheritedHeaders = useMemo(() => {
    const base = inherited?.headers || []
    // When auth is 'none', suppress inherited auth headers — user manages Authorization manually
    if (authType === 'none') {
      return base.filter(h => !h.sourceFolderName.startsWith('auth:'))
    }
    if (authType !== 'inherit') {
      const preview = getAuthHeaderPreviewClient(authType, authConfig)
      if (preview) {
        const alreadyHas = base.some(h => h.key.toLowerCase() === preview.key.toLowerCase() && h.sourceFolderName.startsWith('auth:'))
        if (!alreadyHas) {
          return [...base, {
            key: preview.key,
            value: preview.value,
            description: undefined,
            enabled: true,
            sourceFolderName: `auth:${name || 'folder'}`,
            sourceFolderId: selectedFolderId || '',
          }]
        }
      }
    }
    return base
  }, [inherited?.headers, authType, authConfig, name, selectedFolderId])

  const folder = folderData as Folder | null

  const AUTH_TYPES: { value: AuthType; label: string }[] = [
    { value: 'inherit', label: t('folder.inheritAuth') },
    { value: 'none', label: t('folder.noAuth') },
    { value: 'bearer', label: t('folder.bearerToken') },
    { value: 'basic', label: t('folder.basicAuth') },
    { value: 'apikey', label: t('folder.apiKey') },
    { value: 'jwt', label: t('auth.jwt') },
    { value: 'jwt_freefw', label: t('auth.jwtFreefw') },
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
          <div>
            {inheritedHeaders.length > 0 && (
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
                  {t('inherited.inherited')} ({inheritedHeaders.length})
                </button>
              </div>
            )}
            <KeyValueEditor
              items={headers}
              onChange={handleHeadersChange}
              onBlur={handleHeadersBlur}
              placeholder={t('folder.tabs.headers')}
              variables={variablesForTooltip}
              inheritedItems={inheritedHeaders}
              showInherited={showInherited}
            />
          </div>
        )}

        {activeTab === 'params' && (
          <div>
            {inherited?.queryParams && inherited.queryParams.length > 0 && (
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
                  {t('inherited.inherited')} ({inherited.queryParams.length})
                </button>
              </div>
            )}
            <KeyValueEditor
              items={queryParams}
              onChange={handleParamsChange}
              onBlur={handleParamsBlur}
              placeholder={t('folder.tabs.params')}
              variables={variablesForTooltip}
              inheritedItems={inherited?.queryParams}
              showInherited={showInherited}
            />
          </div>
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

            {authType === 'jwt' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.algorithm')}
                  </label>
                  <select
                    value={authConfig.algorithm || 'HS256'}
                    onChange={(e) => {
                      handleAuthConfigChange('algorithm', e.target.value)
                      handleAuthConfigBlur()
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                  >
                    {JWT_ALGORITHMS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.secretKey')}
                  </label>
                  <textarea
                    value={authConfig.secret || ''}
                    onChange={(e) => handleAuthConfigChange('secret', e.target.value)}
                    onBlur={handleAuthConfigBlur}
                    placeholder="{{jwt_secret}}"
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.payload')}
                  </label>
                  <textarea
                    value={authConfig.payload || '{}'}
                    onChange={(e) => handleAuthConfigChange('payload', e.target.value)}
                    onBlur={handleAuthConfigBlur}
                    placeholder='{"sub": "{{user_id}}", "iat": {{$timestamp}}}'
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {t('auth.headerPrefix')}
                  </label>
                  <input
                    type="text"
                    value={authConfig.headerPrefix || 'Bearer'}
                    onChange={(e) => handleAuthConfigChange('headerPrefix', e.target.value)}
                    onBlur={handleAuthConfigBlur}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {authType === 'jwt_freefw' && (
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
                <p className="mt-1 text-xs text-gray-500">
                  {t('auth.jwtFreefwTokenHelp')}
                </p>
              </div>
            )}

            {authType === 'inherit' && (
              <div>
                <p className="text-sm text-gray-500">
                  {t('folder.inheritAuthHelp')}
                </p>
                {inherited?.auth && inherited.auth.type !== 'none' && (
                  <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700 rounded opacity-60">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">
                        {SHARED_AUTH_TYPES[inherited.auth.type]?.label || inherited.auth.type}
                      </span>
                      <span className="px-1.5 py-0.5 text-xs bg-gray-700/60 text-gray-400 rounded">
                        {inherited.auth.sourceFolderName}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 font-mono">
                      {inherited.auth.type === 'bearer' && (
                        <span>Token: {(inherited.auth.config as Record<string, string>).token ? '••••••••' : '(empty)'}</span>
                      )}
                      {inherited.auth.type === 'jwt_freefw' && (
                        <span>JWT id: {(inherited.auth.config as Record<string, string>).token ? '••••••••' : '(empty)'}</span>
                      )}
                      {inherited.auth.type === 'basic' && (
                        <span>{(inherited.auth.config as Record<string, string>).username || '?'} / •••••</span>
                      )}
                      {inherited.auth.type === 'apikey' && (
                        <span>{(inherited.auth.config as Record<string, string>).key || '?'}: •••••••</span>
                      )}
                      {inherited.auth.type === 'jwt' && (
                        <span>{(inherited.auth.config as Record<string, string>).algorithm || 'HS256'} — ••••••</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
