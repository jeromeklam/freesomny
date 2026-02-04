import type { KeyValueItem, AuthType, AuthConfig } from '@api-client/shared'

// Hoppscotch collection format
interface HoppscotchHeader {
  key: string
  value: string
  active: boolean
}

interface HoppscotchParam {
  key: string
  value: string
  active: boolean
}

interface HoppscotchAuth {
  authType:
    | 'none'
    | 'inherit'
    | 'basic'
    | 'bearer'
    | 'oauth-2'
    | 'api-key'
  authActive: boolean
  // Basic auth
  username?: string
  password?: string
  // Bearer
  token?: string
  // API Key
  key?: string
  value?: string
  addTo?: 'HEADER' | 'QUERY'
  // OAuth2
  grantTypeInfo?: {
    grantType: 'AUTHORIZATION_CODE' | 'CLIENT_CREDENTIALS' | 'PASSWORD' | 'IMPLICIT'
    authEndpoint?: string
    tokenEndpoint?: string
    clientID?: string
    clientSecret?: string
    scopes?: string
  }
}

interface HoppscotchFormDataItem {
  key: string
  value: string
  active: boolean
  isFile: boolean
}

interface HoppscotchBody {
  contentType:
    | 'application/json'
    | 'application/x-www-form-urlencoded'
    | 'multipart/form-data'
    | 'text/plain'
    | null
  body: string | HoppscotchFormDataItem[] | null
}

interface HoppscotchRequest {
  v: number
  id?: string
  name: string
  method: string
  endpoint: string
  params: HoppscotchParam[]
  headers: HoppscotchHeader[]
  preRequestScript: string
  testScript: string
  auth: HoppscotchAuth
  body: HoppscotchBody
}

interface HoppscotchFolder {
  v: number
  id?: string
  name: string
  folders: HoppscotchFolder[]
  requests: HoppscotchRequest[]
  auth?: HoppscotchAuth
  headers?: HoppscotchHeader[]
}

interface HoppscotchCollection {
  v: number
  id?: string
  name: string
  folders: HoppscotchFolder[]
  requests: HoppscotchRequest[]
  auth?: HoppscotchAuth
  headers?: HoppscotchHeader[]
}

interface ImportedVariable {
  key: string
  value: string
  description: string
  type: 'string' | 'secret'
  isSecret: boolean
}

interface ImportedEnvironment {
  name: string
  description: string
  variables: ImportedVariable[]
}

interface ImportedFolder {
  name: string
  description: string
  headers: KeyValueItem[]
  queryParams: KeyValueItem[]
  authType: AuthType
  authConfig: AuthConfig
  preScript: string | null
  postScript: string | null
  baseUrl: string | null
  children: ImportedFolder[]
  requests: ImportedRequest[]
}

interface HoppscotchImportResult {
  folder: ImportedFolder
  environments: ImportedEnvironment[]
}

interface ImportedRequest {
  name: string
  description: string
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

// Convert <<VAR>> syntax to {{VAR}} syntax
function normalizeVariableSyntax(text: string): string {
  return text.replace(/<<([^>]+)>>/g, '{{$1}}')
}

function convertHeaders(headers: HoppscotchHeader[] | undefined): KeyValueItem[] {
  if (!headers) return []
  return headers.map((h) => ({
    key: normalizeVariableSyntax(h.key),
    value: normalizeVariableSyntax(h.value),
    enabled: h.active,
  }))
}

function convertParams(params: HoppscotchParam[] | undefined): KeyValueItem[] {
  if (!params) return []
  return params.map((p) => ({
    key: normalizeVariableSyntax(p.key),
    value: normalizeVariableSyntax(p.value),
    enabled: p.active,
  }))
}

function convertAuth(auth: HoppscotchAuth | undefined): { type: AuthType; config: AuthConfig } {
  if (!auth || !auth.authActive) return { type: 'inherit', config: {} }

  switch (auth.authType) {
    case 'none':
      return { type: 'none', config: {} }
    case 'inherit':
      return { type: 'inherit', config: {} }
    case 'bearer':
      return { type: 'bearer', config: { token: normalizeVariableSyntax(auth.token || '') } }
    case 'basic':
      return {
        type: 'basic',
        config: {
          username: normalizeVariableSyntax(auth.username || ''),
          password: normalizeVariableSyntax(auth.password || ''),
        },
      }
    case 'api-key':
      return {
        type: 'apikey',
        config: {
          key: normalizeVariableSyntax(auth.key || ''),
          value: normalizeVariableSyntax(auth.value || ''),
          addTo: auth.addTo === 'QUERY' ? 'query' : 'header',
        },
      }
    case 'oauth-2': {
      const grant = auth.grantTypeInfo
      return {
        type: 'oauth2',
        config: {
          grantType:
            grant?.grantType === 'CLIENT_CREDENTIALS'
              ? 'client_credentials'
              : grant?.grantType === 'PASSWORD'
                ? 'password'
                : grant?.grantType === 'IMPLICIT'
                  ? 'implicit'
                  : 'authorization_code',
          authUrl: normalizeVariableSyntax(grant?.authEndpoint || ''),
          accessTokenUrl: normalizeVariableSyntax(grant?.tokenEndpoint || ''),
          clientId: normalizeVariableSyntax(grant?.clientID || ''),
          clientSecret: normalizeVariableSyntax(grant?.clientSecret || ''),
          scope: normalizeVariableSyntax(grant?.scopes || ''),
          pkce: false,
          tokenPrefix: 'Bearer',
          headerPrefix: 'Bearer',
          addTo: 'header',
          autoRefresh: true,
        },
      }
    }
    default:
      return { type: 'inherit', config: {} }
  }
}

function convertBodyType(contentType: string | null): string {
  if (!contentType) return 'none'
  switch (contentType) {
    case 'application/json':
      return 'json'
    case 'application/x-www-form-urlencoded':
      return 'urlencoded'
    case 'multipart/form-data':
      return 'form-data'
    case 'text/plain':
      return 'raw'
    default:
      return 'raw'
  }
}

function convertBody(body: HoppscotchBody): string {
  if (!body.body) return ''

  // If body is an array (form-data), convert to JSON string and normalize variables
  if (Array.isArray(body.body)) {
    const normalized = body.body.map((item) => ({
      ...item,
      key: normalizeVariableSyntax(item.key),
      value: normalizeVariableSyntax(item.value),
    }))
    return JSON.stringify(normalized)
  }

  // Otherwise it's a string - normalize variables
  return normalizeVariableSyntax(body.body)
}

function convertRequest(req: HoppscotchRequest): ImportedRequest {
  const auth = convertAuth(req.auth)
  return {
    name: req.name,
    description: '',
    method: req.method,
    url: normalizeVariableSyntax(req.endpoint),
    headers: convertHeaders(req.headers),
    queryParams: convertParams(req.params),
    bodyType: convertBodyType(req.body.contentType),
    body: convertBody(req.body),
    authType: auth.type,
    authConfig: auth.config,
    preScript: req.preRequestScript?.trim() ? normalizeVariableSyntax(req.preRequestScript.trim()) : null,
    postScript: req.testScript?.trim() ? normalizeVariableSyntax(req.testScript.trim()) : null,
  }
}

function convertFolder(folder: HoppscotchFolder): ImportedFolder {
  const auth = convertAuth(folder.auth)
  return {
    name: folder.name,
    description: '',
    headers: convertHeaders(folder.headers),
    queryParams: [],
    authType: auth.type,
    authConfig: auth.config,
    preScript: null,
    postScript: null,
    baseUrl: null,
    children: folder.folders.map(convertFolder),
    requests: folder.requests.map(convertRequest),
  }
}

// Extract variables from text using <<VAR>> or {{VAR}} patterns
function extractVariables(text: string, variables: Set<string>): void {
  // Match <<VAR>> pattern (Hoppscotch style)
  const hoppscotchPattern = /<<([^>]+)>>/g
  let match
  while ((match = hoppscotchPattern.exec(text)) !== null) {
    variables.add(match[1])
  }
  // Match {{VAR}} pattern (common style)
  const commonPattern = /\{\{([^}]+)\}\}/g
  while ((match = commonPattern.exec(text)) !== null) {
    variables.add(match[1])
  }
}

function extractVariablesFromRequest(req: HoppscotchRequest, variables: Set<string>): void {
  extractVariables(req.endpoint, variables)
  req.headers?.forEach((h) => {
    extractVariables(h.key, variables)
    extractVariables(h.value, variables)
  })
  req.params?.forEach((p) => {
    extractVariables(p.key, variables)
    extractVariables(p.value, variables)
  })
  if (typeof req.body?.body === 'string') {
    extractVariables(req.body.body, variables)
  }
  if (req.preRequestScript) {
    extractVariables(req.preRequestScript, variables)
  }
  if (req.testScript) {
    extractVariables(req.testScript, variables)
  }
}

function extractVariablesFromFolder(folder: HoppscotchFolder, variables: Set<string>): void {
  folder.headers?.forEach((h) => {
    extractVariables(h.key, variables)
    extractVariables(h.value, variables)
  })
  folder.requests.forEach((req) => extractVariablesFromRequest(req, variables))
  folder.folders.forEach((f) => extractVariablesFromFolder(f, variables))
}

function extractVariablesFromCollection(collection: HoppscotchCollection): ImportedVariable[] {
  const variables = new Set<string>()

  collection.headers?.forEach((h) => {
    extractVariables(h.key, variables)
    extractVariables(h.value, variables)
  })
  collection.requests.forEach((req) => extractVariablesFromRequest(req, variables))
  collection.folders.forEach((folder) => extractVariablesFromFolder(folder, variables))

  return Array.from(variables).map((key) => ({
    key,
    value: '',
    description: `Imported from ${collection.name}`,
    type: 'string' as const,
    isSecret: key.toLowerCase().includes('secret') ||
              key.toLowerCase().includes('password') ||
              key.toLowerCase().includes('token') ||
              key.toLowerCase().includes('key'),
  }))
}

export function importHoppscotch(collection: HoppscotchCollection): HoppscotchImportResult {
  const auth = convertAuth(collection.auth)
  const folder: ImportedFolder = {
    name: collection.name,
    description: '',
    headers: convertHeaders(collection.headers),
    queryParams: [],
    authType: auth.type,
    authConfig: auth.config,
    preScript: null,
    postScript: null,
    baseUrl: null,
    children: collection.folders.map(convertFolder),
    requests: collection.requests.map(convertRequest),
  }

  // Extract variables from the collection
  const extractedVars = extractVariablesFromCollection(collection)
  const environments: ImportedEnvironment[] = []

  if (extractedVars.length > 0) {
    environments.push({
      name: `${collection.name} - Variables`,
      description: `Variables extracted from ${collection.name} collection`,
      variables: extractedVars,
    })
  }

  return { folder, environments }
}
