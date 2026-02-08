import type { KeyValueItem, AuthType, AuthConfig } from '@api-client/shared'

/**
 * Detect and extract auth configuration from an Authorization header.
 * Supports: Bearer, Basic, JWT id=token (FreeFW format).
 * Returns filtered headers (Authorization removed) and extracted auth config.
 * If no Authorization header or unrecognized scheme, returns original headers with authType='none'.
 */
export function extractAuthFromHeaders(headers: KeyValueItem[]): {
  headers: KeyValueItem[]
  authType: AuthType
  authConfig: AuthConfig
} {
  const authIndex = headers.findIndex((h) => h.key.toLowerCase() === 'authorization')
  if (authIndex === -1) {
    return { headers, authType: 'none', authConfig: {} }
  }

  const value = headers[authIndex].value
  const lowerValue = value.toLowerCase()

  let authType: AuthType = 'none'
  let authConfig: AuthConfig = {}

  if (lowerValue.startsWith('bearer ')) {
    authType = 'bearer'
    authConfig = { token: value.slice(7) }
  } else if (lowerValue.startsWith('basic ')) {
    authType = 'basic'
    const decoded = Buffer.from(value.slice(6), 'base64').toString()
    const colonIndex = decoded.indexOf(':')
    if (colonIndex >= 0) {
      authConfig = { username: decoded.slice(0, colonIndex), password: decoded.slice(colonIndex + 1) }
    } else {
      authConfig = { username: decoded, password: '' }
    }
  } else if (lowerValue.startsWith('jwt id=')) {
    // FreeFW format: JWT id="<token>" or JWT id=<token>
    authType = 'jwt_freefw'
    let token = value.slice(7)
    // Strip surrounding quotes if present
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1)
    }
    authConfig = { token }
  } else {
    // Unknown scheme — leave the header as-is
    return { headers, authType: 'none', authConfig: {} }
  }

  // Remove Authorization header from the list
  const filteredHeaders = headers.filter((_, i) => i !== authIndex)
  return { headers: filteredHeaders, authType, authConfig }
}
