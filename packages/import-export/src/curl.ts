import type { KeyValueItem, AuthType, AuthConfig } from '@api-client/shared'
import { isJsonApiBody } from './jsonapi-detect.js'
import { extractAuthFromHeaders } from './auth-detect.js'

interface ParsedCurl {
  method: string
  url: string
  headers: KeyValueItem[]
  body: string | null
  bodyType: string
  authType: AuthType
  authConfig: AuthConfig
}

function parseQuotedString(str: string): string {
  // Remove surrounding quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1)
  }
  return str
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote: string | null = null
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"' || char === "'") {
      if (inQuote === char) {
        inQuote = null
      } else if (!inQuote) {
        inQuote = char
      } else {
        current += char
      }
      continue
    }

    if (char === ' ' && !inQuote) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

export function parseCurl(curlCommand: string): ParsedCurl {
  // Normalize: remove backslash-newlines
  const normalized = curlCommand.replace(/\\\n\s*/g, ' ').replace(/\\\r\n\s*/g, ' ').trim()

  // Tokenize
  const tokens = tokenize(normalized)

  // Find curl command (skip 'curl' itself)
  const startIndex = tokens[0]?.toLowerCase() === 'curl' ? 1 : 0

  let method = 'GET'
  let url = ''
  let headers: KeyValueItem[] = []
  let body: string | null = null
  let bodyType = 'none'
  let authType: AuthType = 'none'
  let authConfig: AuthConfig = {}

  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i]

    // Method
    if (token === '-X' || token === '--request') {
      method = tokens[++i]?.toUpperCase() || 'GET'
      continue
    }

    // Header
    if (token === '-H' || token === '--header') {
      const headerStr = tokens[++i] || ''
      const colonIndex = headerStr.indexOf(':')
      if (colonIndex > 0) {
        const key = headerStr.slice(0, colonIndex).trim()
        const value = headerStr.slice(colonIndex + 1).trim()
        headers.push({ key, value, enabled: true })
      }
      continue
    }

    // Data (body)
    if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      body = tokens[++i] || ''
      bodyType = 'raw'
      // Detect JSON
      if (body.startsWith('{') || body.startsWith('[')) {
        bodyType = 'json'
      }
      // Set method to POST if not explicitly set
      if (method === 'GET') {
        method = 'POST'
      }
      continue
    }

    // Form data
    if (token === '-F' || token === '--form') {
      const formData = tokens[++i] || ''
      if (!body) body = ''
      body += (body ? '&' : '') + formData
      bodyType = 'form-data'
      if (method === 'GET') {
        method = 'POST'
      }
      continue
    }

    // URL-encoded data
    if (token === '--data-urlencode') {
      const data = tokens[++i] || ''
      if (!body) body = ''
      body += (body ? '&' : '') + encodeURIComponent(data)
      bodyType = 'urlencoded'
      if (method === 'GET') {
        method = 'POST'
      }
      continue
    }

    // Basic auth
    if (token === '-u' || token === '--user') {
      const auth = tokens[++i] || ''
      const [username, password] = auth.split(':')
      authType = 'basic'
      authConfig = { username, password: password || '' }
      continue
    }

    // Location follow
    if (token === '-L' || token === '--location') {
      // We handle this but don't need to store it
      continue
    }

    // Insecure
    if (token === '-k' || token === '--insecure') {
      // We handle this but don't need to store it
      continue
    }

    // Skip other flags
    if (token.startsWith('-')) {
      // Check if it takes an argument
      const nextToken = tokens[i + 1]
      if (nextToken && !nextToken.startsWith('-')) {
        i++ // Skip the argument
      }
      continue
    }

    // URL (anything that's not a flag)
    if (!url && (token.startsWith('http://') || token.startsWith('https://') || token.includes('.'))) {
      url = token
    }
  }

  // Check Content-Type header for JSON:API
  const contentTypeHeader = headers.find((h) => h.key.toLowerCase() === 'content-type')
  if (contentTypeHeader) {
    if (contentTypeHeader.value.includes('application/vnd.api+json')) {
      bodyType = 'jsonapi'
    }
  }

  // Auto-detect JSON:API from body content when bodyType is json
  if (bodyType === 'json' && body && isJsonApiBody(body)) {
    bodyType = 'jsonapi'
  }

  // Check for Authorization header (Bearer, Basic, JWT id=)
  if (authType === 'none') {
    const extracted = extractAuthFromHeaders(headers)
    if (extracted.authType !== 'none') {
      headers = extracted.headers
      authType = extracted.authType
      authConfig = extracted.authConfig
    }
  }

  return {
    method,
    url,
    headers,
    body,
    bodyType,
    authType,
    authConfig,
  }
}

export function toCurl(
  method: string,
  url: string,
  headers: KeyValueItem[],
  body: string | null,
  authType: AuthType,
  authConfig: AuthConfig
): string {
  const parts: string[] = ['curl']

  // Method
  if (method !== 'GET') {
    parts.push('-X', method)
  }

  // Headers
  for (const header of headers) {
    if (header.enabled) {
      parts.push('-H', `'${header.key}: ${header.value}'`)
    }
  }

  // Auth
  if (authType === 'bearer') {
    const token = (authConfig as { token: string }).token
    parts.push('-H', `'Authorization: Bearer ${token}'`)
  } else if (authType === 'basic') {
    const { username, password } = authConfig as { username: string; password: string }
    parts.push('-u', `'${username}:${password}'`)
  } else if (authType === 'jwt_freefw') {
    const token = (authConfig as { token: string }).token
    parts.push('-H', `'Authorization: JWT id="${token}"'`)
  }

  // Body
  if (body) {
    parts.push('-d', `'${body.replace(/'/g, "\\'")}'`)
  }

  // URL
  parts.push(`'${url}'`)

  return parts.join(' ')
}
