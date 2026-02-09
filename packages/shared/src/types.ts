// Key-value item for headers and query params
export interface KeyValueItem {
  key: string
  value: string
  description?: string
  enabled: boolean
  singleKey?: boolean // When true, warn if duplicate keys exist (default: false = multiple allowed)
}

// Auth types
export type AuthType =
  | 'inherit'
  | 'none'
  | 'bearer'
  | 'basic'
  | 'apikey'
  | 'jwt'
  | 'jwt_freefw'
  | 'oauth2'
  | 'openid'
  | 'hawk'

// Auth config shapes
export interface AuthNone {}

export interface AuthBearer {
  token: string
}

export interface AuthBasic {
  username: string
  password: string
}

export interface AuthApiKey {
  key: string
  value: string
  addTo: 'header' | 'query' | 'cookie'
}

export interface AuthJwt {
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512'
  secret: string
  payload: string
  headerPrefix: string
  addTo: 'header' | 'query'
  queryParamName?: string
}

export interface AuthJwtFreefw {
  token: string
}

export interface AuthOAuth2 {
  grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit' | 'refresh_token'
  accessTokenUrl: string
  authUrl?: string
  clientId: string
  clientSecret?: string
  scope?: string
  username?: string
  password?: string
  redirectUri?: string
  audience?: string
  state?: string
  pkce: boolean
  codeChallengeMethod?: 'S256' | 'plain'
  tokenPrefix: string
  headerPrefix: string
  addTo: 'header' | 'query'
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  autoRefresh: boolean
}

export interface AuthOpenId {
  discoveryUrl: string
  clientId: string
  clientSecret?: string
  scope: string
  redirectUri?: string
  responseType?: string
  pkce: boolean
  codeChallengeMethod?: 'S256' | 'plain'
  audience?: string
  authorizationEndpoint?: string
  tokenEndpoint?: string
  userinfoEndpoint?: string
  jwksUri?: string
  accessToken?: string
  idToken?: string
  refreshToken?: string
  expiresAt?: number
  autoRefresh: boolean
  tokenPrefix: string
  addTo: 'header' | 'query'
}

export interface AuthHawk {
  authId: string
  authKey: string
  algorithm: 'sha256' | 'sha1'
  ext?: string
  app?: string
  dlg?: string
  nonce?: string
  timestamp?: string
  includePayloadHash: boolean
}

export type AuthConfig =
  | AuthNone
  | AuthBearer
  | AuthBasic
  | AuthApiKey
  | AuthJwt
  | AuthJwtFreefw
  | AuthOAuth2
  | AuthOpenId
  | AuthHawk

// Folder model
export interface Folder {
  id: string
  name: string
  description: string
  parentId: string | null
  headers: KeyValueItem[]
  queryParams: KeyValueItem[]
  authType: AuthType
  authConfig: AuthConfig
  preScript: string | null
  postScript: string | null
  baseUrl: string | null
  timeout: number | null
  followRedirects: 'inherit' | 'true' | 'false'
  verifySsl: 'inherit' | 'true' | 'false'
  proxy: string | null
  sortOrder: number
  groupId?: string | null
  group?: { id: string; name: string } | null
  createdAt: Date
  updatedAt: Date
  children?: Folder[]
  requests?: Request[]
}

// Request model
export interface Request {
  id: string
  name: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  url: string
  queryParams: KeyValueItem[]
  headers: KeyValueItem[]
  bodyType: 'none' | 'json' | 'jsonapi' | 'form-data' | 'urlencoded' | 'raw' | 'binary'
  body: string
  bodyDescription: string
  authType: AuthType
  authConfig: AuthConfig
  preScript: string | null
  postScript: string | null
  timeout: number | null
  followRedirects: 'inherit' | 'true' | 'false'
  verifySsl: 'inherit' | 'true' | 'false'
  proxy: string | null
  folderId: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

// Environment model
export interface Environment {
  id: string
  name: string
  description: string
  isActive: boolean
  groupId?: string | null
  group?: { id: string; name: string } | null
  variables?: EnvironmentVariable[]
  createdAt: Date
  updatedAt: Date
}

// Environment variable model
export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  description: string
  type: 'string' | 'secret' | 'dynamic'
  scope: 'global' | 'collection' | 'request' | 'local'
  isSecret: boolean
  environmentId: string
}

// Local override model
export interface LocalOverride {
  id: string
  key: string
  value: string
  description: string
  environmentId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

// History entry model
export interface HistoryEntry {
  id: string
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
  responseStatus: number
  responseHeaders: Record<string, string>
  responseBody: string | null
  responseTime: number
  responseSize: number
  createdAt: Date
}

// Resolved request (after inheritance)
export interface ResolvedRequest {
  method: string
  url: string
  headers: Record<string, string>
  queryParams: Record<string, string>
  body: string | null
  bodyType: string
  auth: { type: AuthType; config: AuthConfig }
  preScripts: Array<{ source: string; script: string }>
  postScripts: Array<{ source: string; script: string }>
  timeout: number
  followRedirects: boolean
  verifySsl: boolean
  proxy: string | null
}

// HTTP Response
export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodyEncoding?: 'base64' | 'utf8'
  time: number
  size: number
}

// Resolved view types
export interface ResolvedHeader {
  key: string
  value: string
  source: string
  overrides: Array<{ value: string; source: string }>
}

export interface ResolvedQueryParam {
  key: string
  value: string
  source: string
  overrides: Array<{ value: string; source: string }>
}

export interface ResolvedUrlSegment {
  raw: string
  resolved: string
  source: 'folder' | 'request'
  folderName?: string
  envSource?: string
}

export interface ResolvedAuth {
  type: AuthType
  config: AuthConfig
  resolvedConfig?: Record<string, string>
  source: { type: 'folder' | 'request'; folderName?: string }
  inheritChain: string[]
}

export interface ResolvedScript {
  source: string
  script: string
  description?: string
}

export interface ResolvedView {
  url: {
    final: string
    segments: ResolvedUrlSegment[]
  }
  auth: ResolvedAuth
  headers: ResolvedHeader[]
  queryParams: ResolvedQueryParam[]
  scripts: {
    pre: ResolvedScript[]
    post: ResolvedScript[]
  }
}

// API response wrapper
export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: string
  details?: unknown
}

// Send modes
export type SendMode = 'server' | 'browser' | 'agent'

// Prepared request ready for browser-side or agent execution
export interface PreparedRequest {
  method: string
  url: string // Fully interpolated final URL with query params
  headers: Record<string, string> // Fully interpolated, auth applied
  body: string | null
  requestMeta: {
    requestId: string
    environmentId: string | null
    originalUrl: string
    originalMethod: string
  }
  scripts: {
    pre: {
      logs: Array<{ source: string; message: string }>
      errors: Array<{ source: string; message: string }>
    }
  }
  skipped?: boolean
}

// Report payload sent back after browser-side fetch
export interface BrowserFetchReport {
  requestMeta: PreparedRequest['requestMeta']
  response: HttpResponse
  preScriptLogs?: Array<{ source: string; message: string }>
  preScriptErrors?: Array<{ source: string; message: string }>
}

// Connected agent info
export interface ConnectedAgentInfo {
  id: string
  name: string
  connectedAt: string
  lastHeartbeat: string
}

// Settings
export interface AppSettings {
  proxy: {
    enabled: boolean
    http: string
    https: string
    noProxy: string
  }
  ssl: {
    verifyCertificates: boolean
    clientCert: string | null
    clientKey: string | null
    caCert: string | null
  }
  docker: {
    enabled: boolean
    socketPath: string
  }
  timeout: number
}
