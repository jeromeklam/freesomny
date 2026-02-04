import type { AuthType, AuthConfig, AuthBearer, AuthBasic, AuthApiKey, AuthJwt, AuthOAuth2, AuthOpenId, AuthHawk } from '@api-client/shared'
import jwt from 'jsonwebtoken'
import { createHmac } from 'crypto'

interface AuthResult {
  headers: Record<string, string>
  queryParams: Record<string, string>
  cookies: Record<string, string>
}

// Compute Hawk authorization header
function computeHawkHeader(
  method: string,
  url: string,
  config: AuthHawk,
  body?: string,
  contentType?: string
): string {
  const parsedUrl = new URL(url)
  const timestamp = config.timestamp || Math.floor(Date.now() / 1000).toString()
  const nonce = config.nonce || Math.random().toString(36).substring(2, 10)

  // Build normalized string
  const normalized = [
    'hawk.1.header',
    timestamp,
    nonce,
    method.toUpperCase(),
    parsedUrl.pathname + parsedUrl.search,
    parsedUrl.hostname.toLowerCase(),
    parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'),
    '', // payload hash placeholder
    config.ext || '',
  ].join('\n') + '\n'

  // Compute MAC
  const algorithm = config.algorithm === 'sha1' ? 'sha1' : 'sha256'
  const mac = createHmac(algorithm, config.authKey).update(normalized).digest('base64')

  // Build header
  let header = `Hawk id="${config.authId}", ts="${timestamp}", nonce="${nonce}", mac="${mac}"`
  if (config.ext) {
    header += `, ext="${config.ext}"`
  }
  if (config.app) {
    header += `, app="${config.app}"`
  }
  if (config.dlg) {
    header += `, dlg="${config.dlg}"`
  }

  return header
}

export async function applyAuth(
  authType: AuthType,
  authConfig: AuthConfig,
  method: string,
  url: string,
  body?: string,
  contentType?: string
): Promise<AuthResult> {
  const result: AuthResult = {
    headers: {},
    queryParams: {},
    cookies: {},
  }

  if (authType === 'none' || authType === 'inherit') {
    return result
  }

  switch (authType) {
    case 'bearer': {
      const config = authConfig as AuthBearer
      if (config.token) {
        result.headers['Authorization'] = `Bearer ${config.token}`
      }
      break
    }

    case 'basic': {
      const config = authConfig as AuthBasic
      if (config.username !== undefined) {
        const credentials = Buffer.from(`${config.username}:${config.password || ''}`).toString('base64')
        result.headers['Authorization'] = `Basic ${credentials}`
      }
      break
    }

    case 'apikey': {
      const config = authConfig as AuthApiKey
      if (config.key && config.value) {
        switch (config.addTo) {
          case 'header':
            result.headers[config.key] = config.value
            break
          case 'query':
            result.queryParams[config.key] = config.value
            break
          case 'cookie':
            result.cookies[config.key] = config.value
            break
        }
      }
      break
    }

    case 'jwt': {
      const config = authConfig as AuthJwt
      if (config.secret && config.payload) {
        try {
          // Parse payload JSON and sign
          const payload = JSON.parse(config.payload)
          const token = jwt.sign(payload, config.secret, { algorithm: config.algorithm })

          const prefix = config.headerPrefix || 'Bearer'
          if (config.addTo === 'query' && config.queryParamName) {
            result.queryParams[config.queryParamName] = token
          } else {
            result.headers['Authorization'] = `${prefix} ${token}`
          }
        } catch {
          // Invalid payload or signing error - skip auth
        }
      }
      break
    }

    case 'oauth2': {
      const config = authConfig as AuthOAuth2
      if (config.accessToken) {
        const prefix = config.headerPrefix || 'Bearer'
        if (config.addTo === 'query') {
          result.queryParams['access_token'] = config.accessToken
        } else {
          result.headers['Authorization'] = `${prefix} ${config.accessToken}`
        }
      }
      // Note: Token refresh would be handled by a separate service
      break
    }

    case 'openid': {
      const config = authConfig as AuthOpenId
      if (config.accessToken) {
        const prefix = config.tokenPrefix || 'Bearer'
        if (config.addTo === 'query') {
          result.queryParams['access_token'] = config.accessToken
        } else {
          result.headers['Authorization'] = `${prefix} ${config.accessToken}`
        }
      }
      break
    }

    case 'hawk': {
      const config = authConfig as AuthHawk
      if (config.authId && config.authKey) {
        result.headers['Authorization'] = computeHawkHeader(method, url, config, body, contentType)
      }
      break
    }
  }

  return result
}

// OAuth2 token refresh (for future use)
export async function refreshOAuth2Token(config: AuthOAuth2): Promise<AuthOAuth2 | null> {
  if (!config.refreshToken || !config.accessTokenUrl) {
    return null
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
    })

    if (config.clientSecret) {
      params.append('client_secret', config.clientSecret)
    }

    const response = await fetch(config.accessTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json() as Record<string, unknown>

    return {
      ...config,
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) || config.refreshToken,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in as number) * 1000 : undefined,
    }
  } catch {
    return null
  }
}

// Check if OAuth2 token is expired
export function isTokenExpired(config: AuthOAuth2 | AuthOpenId): boolean {
  if (!config.expiresAt) return false
  // Consider expired if less than 60 seconds remaining
  return Date.now() > config.expiresAt - 60000
}
