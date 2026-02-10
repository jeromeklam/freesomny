import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { clsx } from 'clsx'
import type { AuthType, AuthConfig } from '@api-client/shared'
import { useTranslation } from '../hooks/useTranslation'
import { ResizableModal } from './ResizableModal'

interface CodeGenRequest {
  method: string
  url: string
  headers: Array<{ key: string; value: string; enabled?: boolean }>
  queryParams: Array<{ key: string; value: string; enabled?: boolean }>
  bodyType: string
  body: string
  authType: AuthType
  authConfig: AuthConfig
}

interface InheritedHeader {
  key: string
  value: string
  enabled: boolean
  sourceFolderName: string
}

interface InheritedAuth {
  type: AuthType
  config: AuthConfig
  sourceFolderName: string
}

interface CodeGeneratorModalProps {
  request: CodeGenRequest
  inheritedHeaders?: InheritedHeader[]
  inheritedAuth?: InheritedAuth | null
  onClose: () => void
}

type Language = 'curl' | 'php' | 'python'

function getAuthHeaders(req: CodeGenRequest): Array<{ key: string; value: string }> {
  const headers: Array<{ key: string; value: string }> = []
  switch (req.authType) {
    case 'bearer': {
      const token = (req.authConfig as { token?: string }).token || ''
      if (token) headers.push({ key: 'Authorization', value: `Bearer ${token}` })
      break
    }
    case 'jwt_freefw': {
      const token = (req.authConfig as { token?: string }).token || ''
      if (token) headers.push({ key: 'Authorization', value: `JWT id="${token}"` })
      break
    }
    case 'apikey': {
      const config = req.authConfig as { key?: string; value?: string; addTo?: string }
      if (config.key && config.value && config.addTo === 'header') {
        headers.push({ key: config.key, value: config.value })
      }
      break
    }
    case 'oauth2': {
      const config = req.authConfig as { accessToken?: string; headerPrefix?: string }
      if (config.accessToken) {
        headers.push({ key: 'Authorization', value: `${config.headerPrefix || 'Bearer'} ${config.accessToken}` })
      }
      break
    }
    case 'openid': {
      const config = req.authConfig as { accessToken?: string; tokenPrefix?: string }
      if (config.accessToken) {
        headers.push({ key: 'Authorization', value: `${config.tokenPrefix || 'Bearer'} ${config.accessToken}` })
      }
      break
    }
  }
  return headers
}

function generateCurl(req: CodeGenRequest): string {
  const parts: string[] = ['curl']

  if (req.method !== 'GET') {
    parts.push('-X', req.method)
  }

  // Auth
  if (req.authType === 'basic') {
    const { username, password } = req.authConfig as { username?: string; password?: string }
    parts.push('-u', `'${username || ''}:${password || ''}'`)
  } else {
    for (const ah of getAuthHeaders(req)) {
      parts.push('-H', `'${ah.key}: ${ah.value}'`)
    }
  }

  // Headers
  for (const h of req.headers) {
    if (h.enabled !== false) {
      parts.push('-H', `'${h.key}: ${h.value}'`)
    }
  }

  // Content-Type for body
  if (req.bodyType === 'json') {
    parts.push('-H', "'Content-Type: application/json'")
  } else if (req.bodyType === 'jsonapi') {
    parts.push('-H', "'Content-Type: application/vnd.api+json'")
  } else if (req.bodyType === 'urlencoded') {
    parts.push('-H', "'Content-Type: application/x-www-form-urlencoded'")
  }

  // Body
  if (req.body && req.bodyType !== 'none') {
    parts.push('-d', `'${req.body.replace(/'/g, "\\'")}'`)
  }

  // Query params
  let url = req.url
  const enabledParams = req.queryParams.filter((p) => p.enabled !== false && p.key)
  if (enabledParams.length > 0) {
    const qs = enabledParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }

  parts.push(`'${url}'`)

  return parts.join(' \\\n  ')
}

function generatePhp(req: CodeGenRequest): string {
  const lines: string[] = []
  lines.push('<?php')
  lines.push('')
  lines.push('$ch = curl_init();')
  lines.push('')

  // URL with query params
  let url = req.url
  const enabledParams = req.queryParams.filter((p) => p.enabled !== false && p.key)
  if (enabledParams.length > 0) {
    const qs = enabledParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  lines.push(`curl_setopt($ch, CURLOPT_URL, '${url}');`)
  lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);')

  if (req.method !== 'GET') {
    lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${req.method}');`)
  }

  // Headers
  const headers: string[] = []
  if (req.bodyType === 'json') {
    headers.push("'Content-Type: application/json'")
  } else if (req.bodyType === 'jsonapi') {
    headers.push("'Content-Type: application/vnd.api+json'")
  } else if (req.bodyType === 'urlencoded') {
    headers.push("'Content-Type: application/x-www-form-urlencoded'")
  }

  // Auth headers
  for (const ah of getAuthHeaders(req)) {
    headers.push(`'${ah.key}: ${ah.value}'`)
  }

  for (const h of req.headers) {
    if (h.enabled !== false) {
      headers.push(`'${h.key}: ${h.value}'`)
    }
  }

  if (headers.length > 0) {
    lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [`)
    for (const h of headers) {
      lines.push(`    ${h},`)
    }
    lines.push(']);')
  }

  // Auth (basic uses CURLOPT_USERPWD)
  if (req.authType === 'basic') {
    const { username, password } = req.authConfig as { username?: string; password?: string }
    lines.push(`curl_setopt($ch, CURLOPT_USERPWD, '${username || ''}:${password || ''}');`)
  }

  // Body
  if (req.body && req.bodyType !== 'none') {
    lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, '${req.body.replace(/'/g, "\\'")}');`)
  }

  lines.push('')
  lines.push('$response = curl_exec($ch);')
  lines.push('$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);')
  lines.push('curl_close($ch);')
  lines.push('')
  lines.push('echo "Status: $httpCode\\n";')
  lines.push('echo $response;')

  return lines.join('\n')
}

function generatePython(req: CodeGenRequest): string {
  const lines: string[] = []
  lines.push('import requests')
  lines.push('')

  // URL
  lines.push(`url = '${req.url}'`)

  // Headers
  const headers: Record<string, string> = {}
  if (req.bodyType === 'json') {
    headers['Content-Type'] = 'application/json'
  } else if (req.bodyType === 'jsonapi') {
    headers['Content-Type'] = 'application/vnd.api+json'
  } else if (req.bodyType === 'urlencoded') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  // Auth headers
  for (const ah of getAuthHeaders(req)) {
    headers[ah.key] = ah.value
  }

  for (const h of req.headers) {
    if (h.enabled !== false) {
      headers[h.key] = h.value
    }
  }

  if (Object.keys(headers).length > 0) {
    lines.push('headers = {')
    for (const [k, v] of Object.entries(headers)) {
      lines.push(`    '${k}': '${v}',`)
    }
    lines.push('}')
  }

  // Query params
  const enabledParams = req.queryParams.filter((p) => p.enabled !== false && p.key)
  if (enabledParams.length > 0) {
    lines.push('params = {')
    for (const p of enabledParams) {
      lines.push(`    '${p.key}': '${p.value}',`)
    }
    lines.push('}')
  }

  // Auth
  let authArg = ''
  if (req.authType === 'basic') {
    const { username, password } = req.authConfig as { username?: string; password?: string }
    lines.push(`auth = ('${username || ''}', '${password || ''}')`)
    authArg = ', auth=auth'
  }

  // Body
  let bodyArg = ''
  if (req.body && req.bodyType !== 'none') {
    if (req.bodyType === 'json' || req.bodyType === 'jsonapi') {
      lines.push('import json')
      lines.push(`data = json.loads('''${req.body}''')`)
      bodyArg = ', json=data'
    } else {
      lines.push(`data = '${req.body}'`)
      bodyArg = ', data=data'
    }
  }

  lines.push('')
  const headersArg = Object.keys(headers).length > 0 ? ', headers=headers' : ''
  const paramsArg = enabledParams.length > 0 ? ', params=params' : ''

  lines.push(`response = requests.${req.method.toLowerCase()}(url${headersArg}${paramsArg}${bodyArg}${authArg})`)
  lines.push('')
  lines.push('print(f"Status: {response.status_code}")')
  lines.push('print(response.text)')

  return lines.join('\n')
}

const LANGUAGES: { id: Language; label: string; ext: string }[] = [
  { id: 'curl', label: 'cURL', ext: 'bash' },
  { id: 'php', label: 'PHP', ext: 'php' },
  { id: 'python', label: 'Python', ext: 'py' },
]

const generators: Record<Language, (req: CodeGenRequest) => string> = {
  curl: generateCurl,
  php: generatePhp,
  python: generatePython,
}

function buildMergedRequest(
  request: CodeGenRequest,
  inheritedHeaders?: InheritedHeader[],
  inheritedAuth?: InheritedAuth | null,
): CodeGenRequest {
  // Merge inherited headers with request headers
  const allHeaders: Array<{ key: string; value: string; enabled?: boolean }> = []

  // Add inherited headers first (from parent folders)
  if (inheritedHeaders) {
    for (const h of inheritedHeaders) {
      if (h.enabled) {
        allHeaders.push({ key: h.key, value: h.value, enabled: true })
      }
    }
  }

  // Add request's own headers (may override inherited ones)
  for (const h of request.headers) {
    allHeaders.push(h)
  }

  // Determine effective auth: request's own auth, or inherited if 'inherit'
  let effectiveAuthType = request.authType
  let effectiveAuthConfig = request.authConfig
  if (request.authType === 'inherit' && inheritedAuth && inheritedAuth.type !== 'none') {
    effectiveAuthType = inheritedAuth.type
    effectiveAuthConfig = inheritedAuth.config
  }

  return {
    ...request,
    headers: allHeaders,
    authType: effectiveAuthType,
    authConfig: effectiveAuthConfig,
  }
}

export function CodeGeneratorModal({ request, inheritedHeaders, inheritedAuth, onClose }: CodeGeneratorModalProps) {
  const [language, setLanguage] = useState<Language>('curl')
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()

  const mergedRequest = buildMergedRequest(request, inheritedHeaders, inheritedAuth)
  const code = generators[language](mergedRequest)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ResizableModal
      storageKey="codegen"
      defaultWidth={700}
      defaultHeight={Math.min(window.innerHeight * 0.8, 600)}
      minWidth={400}
      minHeight={300}
      onClose={onClose}
      className="bg-white dark:bg-gray-800"
    >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{t('codegen.title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setLanguage(lang.id)}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                language === lang.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {lang.label}
            </button>
          ))}

          <button
            onClick={handleCopy}
            className="ml-auto mr-3 flex items-center gap-1 px-3 py-1 my-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded hover:border-gray-400 dark:hover:border-gray-500"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t('response.copied') : t('response.copy')}
          </button>
        </div>

        {/* Code output */}
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">{code}</pre>
        </div>
    </ResizableModal>
  )
}
