import { request as undiciRequest, Agent, interceptors, Dispatcher } from 'undici'

const { redirect } = interceptors
import type { ResolvedRequest, HttpResponse, AuthType, AuthConfig } from '@api-client/shared'
import { applyAuth } from './auth.js'
import { resolveVariables, interpolateString, interpolateRecord, getActiveEnvironment } from './environment.js'

interface ExecuteOptions {
  environmentId?: string
  userId?: string
}

// Build full URL with query params
function buildUrl(baseUrl: string, queryParams: Record<string, string>): string {
  const url = new URL(baseUrl)

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.append(key, value)
  }

  return url.toString()
}

// Merge auth result into headers/params
function mergeAuthResult(
  headers: Record<string, string>,
  queryParams: Record<string, string>,
  authResult: { headers: Record<string, string>; queryParams: Record<string, string>; cookies: Record<string, string> }
): void {
  // Auth headers (don't override existing)
  for (const [key, value] of Object.entries(authResult.headers)) {
    if (!headers[key]) {
      headers[key] = value
    }
  }

  // Auth query params
  for (const [key, value] of Object.entries(authResult.queryParams)) {
    if (!queryParams[key]) {
      queryParams[key] = value
    }
  }

  // Cookies
  if (Object.keys(authResult.cookies).length > 0) {
    const cookieHeader = Object.entries(authResult.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    headers['Cookie'] = headers['Cookie'] ? `${headers['Cookie']}; ${cookieHeader}` : cookieHeader
  }
}

export async function executeRequest(
  resolved: ResolvedRequest,
  options: ExecuteOptions = {}
): Promise<HttpResponse> {
  const startTime = Date.now()

  // Get environment variables for interpolation
  let variables = new Map<string, { key: string; value: string; source: 'team' | 'local' | 'dynamic'; isSecret: boolean }>()

  if (options.environmentId) {
    variables = await resolveVariables(options.environmentId, options.userId)
  } else {
    // Try to get active environment
    const activeEnv = await getActiveEnvironment()
    if (activeEnv) {
      variables = await resolveVariables(activeEnv.id, options.userId)
    }
  }

  // Interpolate URL
  let url = await interpolateString(resolved.url, variables)

  // Interpolate headers
  const headers = await interpolateRecord(resolved.headers, variables)

  // Interpolate query params
  const queryParams = await interpolateRecord(resolved.queryParams, variables)

  // Interpolate body if present
  let body: string | null = null
  if (resolved.body) {
    body = await interpolateString(resolved.body, variables)
  }

  // Apply auth
  if (resolved.auth.type !== 'none' && resolved.auth.type !== 'inherit') {
    // Interpolate auth config values
    const authConfigStr = JSON.stringify(resolved.auth.config)
    const interpolatedAuthStr = await interpolateString(authConfigStr, variables)
    const interpolatedAuthConfig = JSON.parse(interpolatedAuthStr) as AuthConfig

    const contentType = headers['Content-Type'] || headers['content-type']
    const authResult = await applyAuth(
      resolved.auth.type,
      interpolatedAuthConfig,
      resolved.method,
      url,
      body || undefined,
      contentType
    )
    mergeAuthResult(headers, queryParams, authResult)
  }

  // Build final URL with query params
  const finalUrl = buildUrl(url, queryParams)

  // Create agent with appropriate settings
  const agentOptions: { connect?: { rejectUnauthorized: boolean } } = {}
  if (!resolved.verifySsl) {
    agentOptions.connect = { rejectUnauthorized: false }
  }

  // Create dispatcher - use redirect interceptor if following redirects
  let dispatcher: Dispatcher = new Agent(agentOptions)
  if (resolved.followRedirects) {
    dispatcher = dispatcher.compose(redirect({ maxRedirections: 10 }))
  }

  // Prepare request options
  const requestOptions: {
    method: string
    headers: Record<string, string>
    headersTimeout?: number
    bodyTimeout?: number
    dispatcher: Dispatcher
    body?: string
  } = {
    method: resolved.method,
    headers,
    headersTimeout: resolved.timeout,
    bodyTimeout: resolved.timeout,
    dispatcher,
  }

  // Add body for non-GET/HEAD requests
  if (body && !['GET', 'HEAD'].includes(resolved.method)) {
    requestOptions.body = body

    // Set Content-Type if not already set
    if (!headers['Content-Type'] && !headers['content-type']) {
      if (resolved.bodyType === 'json') {
        requestOptions.headers = { ...headers, 'Content-Type': 'application/json' }
      } else if (resolved.bodyType === 'jsonapi') {
        requestOptions.headers = { ...headers, 'Content-Type': 'application/vnd.api+json' }
      } else if (resolved.bodyType === 'urlencoded') {
        requestOptions.headers = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }
      } else if (resolved.bodyType === 'raw') {
        requestOptions.headers = { ...headers, 'Content-Type': 'text/plain' }
      }
    }
  }

  try {
    const response = await undiciRequest(finalUrl, requestOptions)

    // Convert headers to Record<string, string>
    const responseHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === 'string') {
        responseHeaders[key] = value
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(', ')
      }
    }

    // Detect binary content types
    const contentType = (responseHeaders['content-type'] || '').toLowerCase()
    const isBinary = contentType.startsWith('image/') ||
      contentType.startsWith('audio/') ||
      contentType.startsWith('video/') ||
      contentType.startsWith('font/') ||
      contentType === 'application/octet-stream' ||
      contentType === 'application/pdf' ||
      contentType.includes('application/zip') ||
      contentType.includes('application/gzip')

    let responseBody: string
    let bodyEncoding: 'base64' | 'utf8' = 'utf8'

    if (isBinary) {
      const buffer = Buffer.from(await response.body.arrayBuffer())
      responseBody = buffer.toString('base64')
      bodyEncoding = 'base64'
    } else {
      responseBody = await response.body.text()
    }

    const endTime = Date.now()

    // Calculate response size
    const contentLength = responseHeaders['content-length']
    const size = contentLength
      ? parseInt(contentLength, 10)
      : bodyEncoding === 'base64'
        ? Math.ceil(responseBody.length * 3 / 4)
        : Buffer.byteLength(responseBody, 'utf8')

    return {
      status: response.statusCode,
      statusText: '', // undici doesn't provide status text
      headers: responseHeaders,
      body: responseBody,
      bodyEncoding,
      time: endTime - startTime,
      size,
    }
  } catch (error) {
    const endTime = Date.now()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: JSON.stringify({ error: errorMessage }),
      time: endTime - startTime,
      size: 0,
    }
  }
}

// Execute an ad-hoc request (not saved)
export async function executeAdHocRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  queryParams: Record<string, string>,
  body: string | null,
  bodyType: string,
  authType: AuthType,
  authConfig: AuthConfig,
  timeout: number,
  followRedirects: boolean,
  verifySsl: boolean,
  options: ExecuteOptions = {}
): Promise<HttpResponse> {
  const resolved: ResolvedRequest = {
    method,
    url,
    headers,
    queryParams,
    body,
    bodyType,
    auth: { type: authType, config: authConfig },
    preScripts: [],
    postScripts: [],
    timeout,
    followRedirects,
    verifySsl,
    proxy: null,
  }

  return executeRequest(resolved, options)
}
