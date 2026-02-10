import { clsx } from 'clsx'
import type { AuthType, AuthConfig, AuthBearer, AuthBasic, AuthApiKey, AuthJwt, AuthJwtFreefw, AuthOAuth2, AuthHawk } from '@api-client/shared'
import { AUTH_TYPES, JWT_ALGORITHMS, OAUTH2_GRANT_TYPES } from '@api-client/shared'
import { useTranslation } from '../hooks/useTranslation'

export interface InheritedAuth {
  type: AuthType
  config: AuthConfig
  sourceFolderName: string
  sourceFolderId: string
}

interface AuthEditorProps {
  authType: AuthType
  authConfig: AuthConfig
  onChange: (type: AuthType, config: AuthConfig) => void
  onBlur?: () => void
  inheritedAuth?: InheritedAuth | null
}

export function AuthEditor({ authType, authConfig, onChange, onBlur, inheritedAuth }: AuthEditorProps) {
  const { t } = useTranslation()

  const handleTypeChange = (type: AuthType) => {
    // Reset config when type changes
    let newConfig: AuthConfig = {}

    switch (type) {
      case 'bearer':
        newConfig = { token: '' } as AuthBearer
        break
      case 'basic':
        newConfig = { username: '', password: '' } as AuthBasic
        break
      case 'apikey':
        newConfig = { key: '', value: '', addTo: 'header' } as AuthApiKey
        break
      case 'jwt':
        newConfig = {
          algorithm: 'HS256',
          secret: '',
          payload: '{}',
          headerPrefix: 'Bearer',
          addTo: 'header',
        } as AuthJwt
        break
      case 'jwt_freefw':
        newConfig = { token: '' } as AuthJwtFreefw
        break
      case 'oauth2':
        newConfig = {
          grantType: 'client_credentials',
          accessTokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: '',
          pkce: false,
          tokenPrefix: 'Bearer',
          headerPrefix: 'Bearer',
          addTo: 'header',
          autoRefresh: true,
        } as AuthOAuth2
        break
      case 'hawk':
        newConfig = {
          authId: '',
          authKey: '',
          algorithm: 'sha256',
          includePayloadHash: false,
        } as AuthHawk
        break
    }

    onChange(type, newConfig)
    onBlur?.()
  }

  const handleConfigChange = (field: string, value: unknown) => {
    onChange(authType, { ...authConfig, [field]: value })
  }

  const inputClass =
    'w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500'
  const labelClass = 'block text-sm text-gray-500 dark:text-gray-400 mb-1'

  return (
    <div className="p-4">
      <div className="mb-4">
        <label className={labelClass}>{t('auth.type')}</label>
        <select
          value={authType}
          onChange={(e) => handleTypeChange(e.target.value as AuthType)}
          className={inputClass}
        >
          {Object.entries(AUTH_TYPES).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {authType === 'inherit' && (
        <div>
          <p className="text-sm text-gray-500">{t('auth.inheritFromParent')}</p>
          {inheritedAuth && inheritedAuth.type !== 'none' && (
            <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {AUTH_TYPES[inheritedAuth.type]?.label || inheritedAuth.type}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-gray-200/60 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 rounded">
                  {inheritedAuth.sourceFolderName}
                </span>
              </div>
              {inheritedAuth.type === 'bearer' && (
                <p className="text-xs text-gray-500 font-mono truncate">
                  Token: {(inheritedAuth.config as AuthBearer).token ? '••••••••' : '(empty)'}
                </p>
              )}
              {inheritedAuth.type === 'jwt_freefw' && (
                <p className="text-xs text-gray-500 font-mono truncate">
                  JWT id={((inheritedAuth.config as AuthJwtFreefw).token) ? '••••••••' : '(empty)'}
                </p>
              )}
              {inheritedAuth.type === 'basic' && (
                <p className="text-xs text-gray-500 font-mono">
                  {(inheritedAuth.config as AuthBasic).username || '(empty)'} / ••••••
                </p>
              )}
              {inheritedAuth.type === 'apikey' && (
                <p className="text-xs text-gray-500 font-mono truncate">
                  {(inheritedAuth.config as AuthApiKey).key}: ••••••••
                </p>
              )}
              {inheritedAuth.type === 'jwt' && (
                <p className="text-xs text-gray-500 font-mono">
                  {(inheritedAuth.config as AuthJwt).algorithm || 'HS256'} — ••••••
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {authType === 'none' && (
        <p className="text-sm text-gray-500">{t('auth.noAuth')}</p>
      )}

      {authType === 'bearer' && (
        <div>
          <label className={labelClass}>{t('auth.token')}</label>
          <input
            type="text"
            value={(authConfig as AuthBearer).token || ''}
            onChange={(e) => handleConfigChange('token', e.target.value)}
            onBlur={onBlur}
            placeholder="{{token}} or paste token"
            className={clsx(inputClass, 'font-mono')}
          />
          <p className="mt-1 text-xs text-gray-500">{t('auth.tokenHelp')}</p>
        </div>
      )}

      {authType === 'basic' && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('auth.username')}</label>
            <input
              type="text"
              value={(authConfig as AuthBasic).username || ''}
              onChange={(e) => handleConfigChange('username', e.target.value)}
              onBlur={onBlur}
              placeholder="{{username}}"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.password')}</label>
            <input
              type="password"
              value={(authConfig as AuthBasic).password || ''}
              onChange={(e) => handleConfigChange('password', e.target.value)}
              onBlur={onBlur}
              placeholder="{{password}}"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {authType === 'apikey' && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('auth.keyName')}</label>
            <input
              type="text"
              value={(authConfig as AuthApiKey).key || ''}
              onChange={(e) => handleConfigChange('key', e.target.value)}
              onBlur={onBlur}
              placeholder="X-API-Key"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('common.value')}</label>
            <input
              type="text"
              value={(authConfig as AuthApiKey).value || ''}
              onChange={(e) => handleConfigChange('value', e.target.value)}
              onBlur={onBlur}
              placeholder="{{api_key}}"
              className={clsx(inputClass, 'font-mono')}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.addTo')}</label>
            <select
              value={(authConfig as AuthApiKey).addTo || 'header'}
              onChange={(e) => {
                handleConfigChange('addTo', e.target.value)
                onBlur?.()
              }}
              className={inputClass}
            >
              <option value="header">{t('auth.header')}</option>
              <option value="query">{t('auth.queryParameter')}</option>
              <option value="cookie">{t('auth.cookie')}</option>
            </select>
          </div>
        </div>
      )}

      {authType === 'jwt' && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('auth.algorithm')}</label>
            <select
              value={(authConfig as AuthJwt).algorithm || 'HS256'}
              onChange={(e) => {
                handleConfigChange('algorithm', e.target.value)
                onBlur?.()
              }}
              className={inputClass}
            >
              {JWT_ALGORITHMS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('auth.secretKey')}</label>
            <textarea
              value={(authConfig as AuthJwt).secret || ''}
              onChange={(e) => handleConfigChange('secret', e.target.value)}
              onBlur={onBlur}
              placeholder="{{jwt_secret}} or paste key"
              rows={3}
              className={clsx(inputClass, 'font-mono')}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.payload')}</label>
            <textarea
              value={(authConfig as AuthJwt).payload || '{}'}
              onChange={(e) => handleConfigChange('payload', e.target.value)}
              onBlur={onBlur}
              placeholder='{"sub": "{{user_id}}", "iat": {{$timestamp}}}'
              rows={4}
              className={clsx(inputClass, 'font-mono')}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.headerPrefix')}</label>
            <input
              type="text"
              value={(authConfig as AuthJwt).headerPrefix || 'Bearer'}
              onChange={(e) => handleConfigChange('headerPrefix', e.target.value)}
              onBlur={onBlur}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {authType === 'jwt_freefw' && (
        <div>
          <label className={labelClass}>{t('auth.token')}</label>
          <input
            type="text"
            value={(authConfig as AuthJwtFreefw).token || ''}
            onChange={(e) => handleConfigChange('token', e.target.value)}
            onBlur={onBlur}
            placeholder="{{token}} or paste token"
            className={clsx(inputClass, 'font-mono')}
          />
          <p className="mt-1 text-xs text-gray-500">{t('auth.jwtFreefwTokenHelp')}</p>
        </div>
      )}

      {authType === 'oauth2' && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('auth.grantType')}</label>
            <select
              value={(authConfig as AuthOAuth2).grantType || 'client_credentials'}
              onChange={(e) => {
                handleConfigChange('grantType', e.target.value)
                onBlur?.()
              }}
              className={inputClass}
            >
              {OAUTH2_GRANT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('auth.tokenUrl')}</label>
            <input
              type="text"
              value={(authConfig as AuthOAuth2).accessTokenUrl || ''}
              onChange={(e) => handleConfigChange('accessTokenUrl', e.target.value)}
              onBlur={onBlur}
              placeholder="{{host}}/oauth/token"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.clientId')}</label>
            <input
              type="text"
              value={(authConfig as AuthOAuth2).clientId || ''}
              onChange={(e) => handleConfigChange('clientId', e.target.value)}
              onBlur={onBlur}
              placeholder="{{client_id}}"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.clientSecret')}</label>
            <input
              type="password"
              value={(authConfig as AuthOAuth2).clientSecret || ''}
              onChange={(e) => handleConfigChange('clientSecret', e.target.value)}
              onBlur={onBlur}
              placeholder="{{client_secret}}"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.scope')}</label>
            <input
              type="text"
              value={(authConfig as AuthOAuth2).scope || ''}
              onChange={(e) => handleConfigChange('scope', e.target.value)}
              onBlur={onBlur}
              placeholder="read write"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(authConfig as AuthOAuth2).pkce || false}
              onChange={(e) => {
                handleConfigChange('pkce', e.target.checked)
                onBlur?.()
              }}
              className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
            <label className="text-sm">{t('auth.enablePkce')}</label>
          </div>
        </div>
      )}

      {authType === 'hawk' && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('auth.authId')}</label>
            <input
              type="text"
              value={(authConfig as AuthHawk).authId || ''}
              onChange={(e) => handleConfigChange('authId', e.target.value)}
              onBlur={onBlur}
              placeholder="{{hawk_id}}"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.authKey')}</label>
            <input
              type="password"
              value={(authConfig as AuthHawk).authKey || ''}
              onChange={(e) => handleConfigChange('authKey', e.target.value)}
              onBlur={onBlur}
              placeholder="{{hawk_key}}"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('auth.algorithm')}</label>
            <select
              value={(authConfig as AuthHawk).algorithm || 'sha256'}
              onChange={(e) => {
                handleConfigChange('algorithm', e.target.value)
                onBlur?.()
              }}
              className={inputClass}
            >
              <option value="sha256">SHA-256</option>
              <option value="sha1">SHA-1</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(authConfig as AuthHawk).includePayloadHash || false}
              onChange={(e) => {
                handleConfigChange('includePayloadHash', e.target.checked)
                onBlur?.()
              }}
              className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
            <label className="text-sm">{t('auth.includePayloadHash')}</label>
          </div>
        </div>
      )}
    </div>
  )
}
