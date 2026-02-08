import type { Folder, Request } from '@prisma/client'
import type {
  KeyValueItem,
  AuthType,
  AuthConfig,
  AuthBearer,
  AuthBasic,
  AuthApiKey,
  AuthJwtFreefw,
  AuthOAuth2,
  AuthOpenId,
  ResolvedRequest,
  ResolvedView,
  ResolvedHeader,
  ResolvedQueryParam,
  ResolvedUrlSegment,
  ResolvedAuth,
  ResolvedScript,
} from '@api-client/shared'
import { DEFAULT_TIMEOUT } from '@api-client/shared'
import { prisma } from '../lib/prisma.js'
import { parseHeaders, parseQueryParams, parseAuthConfig } from '../lib/json.js'

interface FolderWithParsed {
  id: string
  name: string
  parentId: string | null
  headers: KeyValueItem[]
  queryParams: KeyValueItem[]
  authType: AuthType
  authConfig: AuthConfig
  preScript: string | null
  postScript: string | null
  baseUrl: string | null
  timeout: number | null
  followRedirects: string
  verifySsl: string
  proxy: string | null
}

interface RequestWithParsed {
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
  timeout: number | null
  followRedirects: string
  verifySsl: string
  proxy: string | null
  folderId: string
}

function parseFolder(folder: Folder): FolderWithParsed {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    headers: parseHeaders(folder.headers),
    queryParams: parseQueryParams(folder.queryParams),
    authType: folder.authType as AuthType,
    authConfig: parseAuthConfig(folder.authConfig),
    preScript: folder.preScript,
    postScript: folder.postScript,
    baseUrl: folder.baseUrl,
    timeout: folder.timeout,
    followRedirects: folder.followRedirects,
    verifySsl: folder.verifySsl,
    proxy: folder.proxy,
  }
}

function parseRequest(request: Request): RequestWithParsed {
  return {
    id: request.id,
    name: request.name,
    method: request.method,
    url: request.url,
    headers: parseHeaders(request.headers),
    queryParams: parseQueryParams(request.queryParams),
    bodyType: request.bodyType,
    body: request.body,
    authType: request.authType as AuthType,
    authConfig: parseAuthConfig(request.authConfig),
    preScript: request.preScript,
    postScript: request.postScript,
    timeout: request.timeout,
    followRedirects: request.followRedirects,
    verifySsl: request.verifySsl,
    proxy: request.proxy,
    folderId: request.folderId,
  }
}

// Get ancestor chain from root to immediate parent (inclusive)
async function getAncestorChain(folderId: string): Promise<FolderWithParsed[]> {
  const chain: FolderWithParsed[] = []
  let currentId: string | null = folderId

  while (currentId) {
    const dbFolder: Folder | null = await prisma.folder.findUnique({ where: { id: currentId } })
    if (!dbFolder) break
    chain.unshift(parseFolder(dbFolder))
    currentId = dbFolder.parentId
  }

  return chain
}

// Join URL segments properly
function joinUrl(base: string, segment: string): string {
  if (!base && !segment) return ''
  if (!base) return segment
  if (!segment) return base

  // Remove trailing slash from base and leading slash from segment
  const cleanBase = base.replace(/\/+$/, '')
  const cleanSegment = segment.replace(/^\/+/, '')

  return cleanSegment ? `${cleanBase}/${cleanSegment}` : cleanBase
}

// Merge headers - child overrides parent by key
function mergeHeaders(
  chain: FolderWithParsed[],
  requestHeaders: KeyValueItem[]
): Map<string, { value: string; source: string; history: Array<{ value: string; source: string }> }> {
  const merged = new Map<string, { value: string; source: string; history: Array<{ value: string; source: string }> }>()

  // Process folders from root to leaf
  for (const folder of chain) {
    for (const header of folder.headers) {
      if (!header.enabled) continue
      // Authorization is always managed by the Auth tab — never include in headers
      if (header.key.toLowerCase() === 'authorization') continue
      const existing = merged.get(header.key)
      if (existing) {
        existing.history.push({ value: existing.value, source: existing.source })
        existing.value = header.value
        existing.source = folder.name
      } else {
        merged.set(header.key, { value: header.value, source: folder.name, history: [] })
      }
    }
  }

  // Process request headers last
  for (const header of requestHeaders) {
    if (!header.enabled) continue
    const existing = merged.get(header.key)
    if (existing) {
      existing.history.push({ value: existing.value, source: existing.source })
      existing.value = header.value
      existing.source = 'request'
    } else {
      merged.set(header.key, { value: header.value, source: 'request', history: [] })
    }
  }

  return merged
}

// Resolve auth - walk up until non-"inherit" found
function resolveAuth(
  chain: FolderWithParsed[],
  requestAuthType: AuthType,
  requestAuthConfig: AuthConfig
): { type: AuthType; config: AuthConfig; source: { type: 'folder' | 'request'; folderName?: string }; inheritChain: string[] } {
  const inheritChain: string[] = []

  if (requestAuthType !== 'inherit') {
    inheritChain.push(`request:${requestAuthType}`)
    return {
      type: requestAuthType,
      config: requestAuthConfig,
      source: { type: 'request' },
      inheritChain,
    }
  }

  inheritChain.push('request:inherit')

  // Walk up from closest folder to root
  for (let i = chain.length - 1; i >= 0; i--) {
    const folder = chain[i]
    if (folder.authType !== 'inherit') {
      inheritChain.push(`${folder.name}:${folder.authType}`)
      return {
        type: folder.authType,
        config: folder.authConfig,
        source: { type: 'folder', folderName: folder.name },
        inheritChain,
      }
    }
    inheritChain.push(`${folder.name}:inherit`)
  }

  // Default to none if no auth found
  return {
    type: 'none',
    config: {},
    source: { type: 'folder', folderName: chain[0]?.name || 'root' },
    inheritChain,
  }
}

// Resolve boolean-like inherit values
function resolveInheritBool(
  chain: FolderWithParsed[],
  requestValue: string,
  getter: (f: FolderWithParsed) => string,
  defaultValue: boolean
): boolean {
  if (requestValue === 'true') return true
  if (requestValue === 'false') return false

  // Walk up from closest folder to root
  for (let i = chain.length - 1; i >= 0; i--) {
    const value = getter(chain[i])
    if (value === 'true') return true
    if (value === 'false') return false
  }

  return defaultValue
}

// Resolve nullable values
function resolveNullable<T>(
  chain: FolderWithParsed[],
  requestValue: T | null,
  getter: (f: FolderWithParsed) => T | null,
  defaultValue: T
): T {
  if (requestValue !== null) return requestValue

  for (let i = chain.length - 1; i >= 0; i--) {
    const value = getter(chain[i])
    if (value !== null) return value
  }

  return defaultValue
}

// Collect scripts in execution order
function collectScripts(
  chain: FolderWithParsed[],
  requestScript: string | null,
  getter: (f: FolderWithParsed) => string | null,
  isPreScript: boolean
): Array<{ source: string; script: string }> {
  const scripts: Array<{ source: string; script: string }> = []

  if (isPreScript) {
    // Pre-scripts: root → leaf → request
    for (const folder of chain) {
      const script = getter(folder)
      if (script) scripts.push({ source: folder.name, script })
    }
    if (requestScript) scripts.push({ source: 'request', script: requestScript })
  } else {
    // Post-scripts: request → leaf → root
    if (requestScript) scripts.push({ source: 'request', script: requestScript })
    for (let i = chain.length - 1; i >= 0; i--) {
      const script = getter(chain[i])
      if (script) scripts.push({ source: chain[i].name, script })
    }
  }

  return scripts
}

export async function resolveRequest(requestId: string): Promise<ResolvedRequest> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    throw new Error(`Request not found: ${requestId}`)
  }

  const parsedRequest = parseRequest(request)
  const chain = await getAncestorChain(request.folderId)

  // Merge headers
  const mergedHeaders = mergeHeaders(chain, parsedRequest.headers)
  const headers: Record<string, string> = {}
  for (const [key, { value }] of mergedHeaders) {
    headers[key] = value
  }

  // Merge query params (same logic as headers)
  const mergedParamsMap = new Map<string, { value: string; source: string }>()
  for (const folder of chain) {
    for (const param of folder.queryParams) {
      if (param.enabled) mergedParamsMap.set(param.key, { value: param.value, source: folder.name })
    }
  }
  for (const param of parsedRequest.queryParams) {
    if (param.enabled) mergedParamsMap.set(param.key, { value: param.value, source: 'request' })
  }
  const queryParams: Record<string, string> = {}
  for (const [key, { value }] of mergedParamsMap) {
    queryParams[key] = value
  }

  // Resolve auth
  const auth = resolveAuth(chain, parsedRequest.authType, parsedRequest.authConfig)

  // Build URL
  let baseUrl = ''
  for (const folder of chain) {
    if (folder.baseUrl) {
      baseUrl = joinUrl(baseUrl, folder.baseUrl)
    }
  }
  const url = joinUrl(baseUrl, parsedRequest.url)

  // Collect scripts
  const preScripts = collectScripts(chain, parsedRequest.preScript, f => f.preScript, true)
  const postScripts = collectScripts(chain, parsedRequest.postScript, f => f.postScript, false)

  // Resolve network settings
  const timeout = resolveNullable(chain, parsedRequest.timeout, f => f.timeout, DEFAULT_TIMEOUT)
  const followRedirects = resolveInheritBool(chain, parsedRequest.followRedirects, f => f.followRedirects, true)
  const verifySsl = resolveInheritBool(chain, parsedRequest.verifySsl, f => f.verifySsl, true)
  const proxy = resolveNullable(chain, parsedRequest.proxy, f => f.proxy, null as string | null)

  return {
    method: parsedRequest.method,
    url,
    headers,
    queryParams,
    body: parsedRequest.body || null,
    bodyType: parsedRequest.bodyType,
    auth: { type: auth.type, config: auth.config },
    preScripts,
    postScripts,
    timeout,
    followRedirects,
    verifySsl,
    proxy,
  }
}

// Inherited context — returns only folder-level headers/params/auth (not the request's own)
export interface InheritedItem {
  key: string
  value: string
  description?: string
  enabled: boolean
  sourceFolderName: string
  sourceFolderId: string
}

export interface InheritedContext {
  headers: InheritedItem[]
  queryParams: InheritedItem[]
  auth: {
    type: AuthType
    config: AuthConfig
    sourceFolderName: string
    sourceFolderId: string
  } | null
}

export async function getInheritedContext(requestId: string): Promise<InheritedContext> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    throw new Error(`Request not found: ${requestId}`)
  }

  const chain = await getAncestorChain(request.folderId)

  const headers: InheritedItem[] = []
  const queryParams: InheritedItem[] = []

  for (const folder of chain) {
    for (const header of folder.headers) {
      if (!header.enabled) continue
      // Authorization is always managed by the Auth tab — never include in headers
      if (header.key.toLowerCase() === 'authorization') continue
      headers.push({
        key: header.key,
        value: header.value,
        description: header.description,
        enabled: header.enabled,
        sourceFolderName: folder.name,
        sourceFolderId: folder.id,
      })
    }
    for (const param of folder.queryParams) {
      if (!param.enabled) continue
      queryParams.push({
        key: param.key,
        value: param.value,
        description: param.description,
        enabled: param.enabled,
        sourceFolderName: folder.name,
        sourceFolderId: folder.id,
      })
    }
  }

  // Resolve auth from folder chain (walk leaf → root, find first non-inherit)
  let auth: InheritedContext['auth'] = null
  for (let i = chain.length - 1; i >= 0; i--) {
    const folder = chain[i]
    if (folder.authType !== 'inherit') {
      auth = {
        type: folder.authType,
        config: folder.authConfig,
        sourceFolderName: folder.name,
        sourceFolderId: folder.id,
      }
      break
    }
  }

  // Add auth-generated Authorization header as inherited item so it shows in the Headers tab
  if (auth && auth.type !== 'none') {
    const authHeader = getAuthHeaderPreview(auth.type, auth.config)
    if (authHeader) {
      headers.push({
        key: authHeader.key,
        value: authHeader.value,
        description: undefined,
        enabled: true,
        sourceFolderName: `auth:${auth.sourceFolderName}`,
        sourceFolderId: auth.sourceFolderId,
      })
    }
  }

  return { headers, queryParams, auth }
}

export async function getInheritedContextForFolder(folderId: string): Promise<InheritedContext> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
  })

  if (!folder) {
    throw new Error(`Folder not found: ${folderId}`)
  }

  // Root folder has no parent => no inherited context
  if (!folder.parentId) {
    return { headers: [], queryParams: [], auth: null }
  }

  const chain = await getAncestorChain(folder.parentId)

  const headers: InheritedItem[] = []
  const queryParams: InheritedItem[] = []

  for (const ancestor of chain) {
    for (const header of ancestor.headers) {
      if (!header.enabled) continue
      // Authorization is always managed by the Auth tab — never include in headers
      if (header.key.toLowerCase() === 'authorization') continue
      headers.push({
        key: header.key,
        value: header.value,
        description: header.description,
        enabled: header.enabled,
        sourceFolderName: ancestor.name,
        sourceFolderId: ancestor.id,
      })
    }
    for (const param of ancestor.queryParams) {
      if (!param.enabled) continue
      queryParams.push({
        key: param.key,
        value: param.value,
        description: param.description,
        enabled: param.enabled,
        sourceFolderName: ancestor.name,
        sourceFolderId: ancestor.id,
      })
    }
  }

  // Resolve auth from ancestor chain (walk leaf → root, find first non-inherit)
  let auth: InheritedContext['auth'] = null
  for (let i = chain.length - 1; i >= 0; i--) {
    const ancestor = chain[i]
    if (ancestor.authType !== 'inherit') {
      auth = {
        type: ancestor.authType,
        config: ancestor.authConfig,
        sourceFolderName: ancestor.name,
        sourceFolderId: ancestor.id,
      }
      break
    }
  }

  // Add auth-generated Authorization header as inherited item so it shows in the Headers tab
  if (auth && auth.type !== 'none') {
    const authHeader = getAuthHeaderPreview(auth.type, auth.config)
    if (authHeader) {
      headers.push({
        key: authHeader.key,
        value: authHeader.value,
        description: undefined,
        enabled: true,
        sourceFolderName: `auth:${auth.sourceFolderName}`,
        sourceFolderId: auth.sourceFolderId,
      })
    }
  }

  return { headers, queryParams, auth }
}

// Preview the Authorization header that auth config will generate (before variable interpolation)
function getAuthHeaderPreview(authType: AuthType, authConfig: AuthConfig): { key: string; value: string } | null {
  switch (authType) {
    case 'bearer': {
      const config = authConfig as AuthBearer
      return config.token ? { key: 'Authorization', value: `Bearer ${config.token}` } : null
    }
    case 'basic': {
      const config = authConfig as AuthBasic
      if (config.username !== undefined) {
        return { key: 'Authorization', value: `Basic ${Buffer.from(`${config.username}:${config.password || ''}`).toString('base64')}` }
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

export async function getResolvedView(requestId: string): Promise<ResolvedView> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    throw new Error(`Request not found: ${requestId}`)
  }

  const parsedRequest = parseRequest(request)
  const chain = await getAncestorChain(request.folderId)

  // Build URL segments
  const urlSegments: ResolvedUrlSegment[] = []
  for (const folder of chain) {
    if (folder.baseUrl) {
      urlSegments.push({
        raw: folder.baseUrl,
        resolved: folder.baseUrl,
        source: 'folder',
        folderName: folder.name,
      })
    }
  }
  if (parsedRequest.url) {
    urlSegments.push({
      raw: parsedRequest.url,
      resolved: parsedRequest.url,
      source: 'request',
    })
  }

  // Build final URL
  let finalUrl = ''
  for (const segment of urlSegments) {
    finalUrl = joinUrl(finalUrl, segment.resolved)
  }

  // Get merged headers with full traceability
  const mergedHeaders = mergeHeaders(chain, parsedRequest.headers)
  const resolvedHeaders: ResolvedHeader[] = []
  for (const [key, { value, source, history }] of mergedHeaders) {
    resolvedHeaders.push({
      key,
      value,
      source,
      overrides: history.reverse(), // Most recent override first
    })
  }

  // Get merged query params with traceability
  const mergedParams = new Map<string, { value: string; source: string; history: Array<{ value: string; source: string }> }>()
  for (const folder of chain) {
    for (const param of folder.queryParams) {
      if (!param.enabled) continue
      const existing = mergedParams.get(param.key)
      if (existing) {
        existing.history.push({ value: existing.value, source: existing.source })
        existing.value = param.value
        existing.source = folder.name
      } else {
        mergedParams.set(param.key, { value: param.value, source: folder.name, history: [] })
      }
    }
  }
  for (const param of parsedRequest.queryParams) {
    if (!param.enabled) continue
    const existing = mergedParams.get(param.key)
    if (existing) {
      existing.history.push({ value: existing.value, source: existing.source })
      existing.value = param.value
      existing.source = 'request'
    } else {
      mergedParams.set(param.key, { value: param.value, source: 'request', history: [] })
    }
  }
  const resolvedQueryParams: ResolvedQueryParam[] = []
  for (const [key, { value, source, history }] of mergedParams) {
    resolvedQueryParams.push({
      key,
      value,
      source,
      overrides: history.reverse(),
    })
  }

  // Get auth with full chain
  const auth = resolveAuth(chain, parsedRequest.authType, parsedRequest.authConfig)
  const resolvedAuth: ResolvedAuth = {
    type: auth.type,
    config: auth.config,
    source: auth.source,
    inheritChain: auth.inheritChain,
  }

  // Add auth-generated header to resolved headers so user can preview the actual Authorization value
  if (auth.type !== 'none' && auth.type !== 'inherit') {
    const authHeader = getAuthHeaderPreview(auth.type, auth.config)
    if (authHeader) {
      const sourceName = auth.source.type === 'folder'
        ? `auth:${auth.source.folderName}`
        : 'auth:request'
      resolvedHeaders.push({
        key: authHeader.key,
        value: authHeader.value,
        source: sourceName,
        overrides: [],
      })
    }
  }

  // Get scripts
  const preScripts = collectScripts(chain, parsedRequest.preScript, f => f.preScript, true)
  const postScripts = collectScripts(chain, parsedRequest.postScript, f => f.postScript, false)

  return {
    url: { final: finalUrl, segments: urlSegments },
    auth: resolvedAuth,
    headers: resolvedHeaders,
    queryParams: resolvedQueryParams,
    scripts: {
      pre: preScripts.map(s => ({ source: s.source, script: s.script })),
      post: postScripts.map(s => ({ source: s.source, script: s.script })),
    },
  }
}
