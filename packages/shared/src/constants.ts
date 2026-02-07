// Default timeout in milliseconds
export const DEFAULT_TIMEOUT = 30000

// Maximum timeout in milliseconds (10 minutes)
export const MAX_TIMEOUT = 600000

// Default settings
export const DEFAULT_SETTINGS = {
  proxy: {
    enabled: false,
    http: '',
    https: '',
    noProxy: 'localhost,127.0.0.1,172.17.0.0/16,172.18.0.0/16,10.0.0.0/8',
  },
  ssl: {
    verifyCertificates: true,
    clientCert: null,
    clientKey: null,
    caCert: null,
  },
  docker: {
    enabled: false,
    socketPath: '/var/run/docker.sock',
  },
  timeout: DEFAULT_TIMEOUT,
}

// HTTP methods with their typical use cases
export const HTTP_METHODS = {
  GET: { label: 'GET', color: 'green', description: 'Retrieve data' },
  POST: { label: 'POST', color: 'yellow', description: 'Create resource' },
  PUT: { label: 'PUT', color: 'blue', description: 'Replace resource' },
  PATCH: { label: 'PATCH', color: 'purple', description: 'Update resource' },
  DELETE: { label: 'DELETE', color: 'red', description: 'Delete resource' },
  HEAD: { label: 'HEAD', color: 'gray', description: 'Get headers only' },
  OPTIONS: { label: 'OPTIONS', color: 'gray', description: 'Get allowed methods' },
} as const

// Body types
export const BODY_TYPES = {
  none: { label: 'None', contentType: null },
  json: { label: 'JSON', contentType: 'application/json' },
  jsonapi: { label: 'JSON:API', contentType: 'application/vnd.api+json' },
  'form-data': { label: 'Form Data', contentType: 'multipart/form-data' },
  urlencoded: { label: 'URL Encoded', contentType: 'application/x-www-form-urlencoded' },
  raw: { label: 'Raw', contentType: 'text/plain' },
  binary: { label: 'Binary', contentType: 'application/octet-stream' },
} as const

// Auth types
export const AUTH_TYPES = {
  inherit: { label: 'Inherit from parent', description: 'Use parent folder auth settings' },
  none: { label: 'None', description: 'No authentication' },
  bearer: { label: 'Bearer Token', description: 'Bearer token in Authorization header' },
  basic: { label: 'Basic Auth', description: 'HTTP Basic authentication' },
  apikey: { label: 'API Key', description: 'API key in header, query, or cookie' },
  jwt: { label: 'JWT', description: 'JSON Web Token (signed at send time)' },
  oauth2: { label: 'OAuth 2.0', description: 'OAuth 2.0 authorization' },
  openid: { label: 'OpenID Connect', description: 'OpenID Connect with auto-discovery' },
  hawk: { label: 'Hawk', description: 'Hawk HTTP authentication' },
} as const

// JWT algorithms
export const JWT_ALGORITHMS = [
  { value: 'HS256', label: 'HS256', type: 'hmac' },
  { value: 'HS384', label: 'HS384', type: 'hmac' },
  { value: 'HS512', label: 'HS512', type: 'hmac' },
  { value: 'RS256', label: 'RS256', type: 'rsa' },
  { value: 'RS384', label: 'RS384', type: 'rsa' },
  { value: 'RS512', label: 'RS512', type: 'rsa' },
  { value: 'ES256', label: 'ES256', type: 'ecdsa' },
  { value: 'ES384', label: 'ES384', type: 'ecdsa' },
  { value: 'ES512', label: 'ES512', type: 'ecdsa' },
] as const

// OAuth 2.0 grant types
export const OAUTH2_GRANT_TYPES = [
  { value: 'authorization_code', label: 'Authorization Code', description: 'Standard OAuth2 flow with redirect' },
  { value: 'client_credentials', label: 'Client Credentials', description: 'Machine-to-machine auth' },
  { value: 'password', label: 'Password', description: 'Resource owner password grant' },
  { value: 'implicit', label: 'Implicit', description: 'Legacy browser-based flow' },
  { value: 'refresh_token', label: 'Refresh Token', description: 'Exchange refresh token for access token' },
] as const

// Variable types
export const VARIABLE_TYPES = {
  string: { label: 'String', description: 'Plain text value' },
  secret: { label: 'Secret', description: 'Encrypted, masked in UI' },
  dynamic: { label: 'Dynamic', description: 'Generated at runtime' },
} as const

// Variable scopes
export const VARIABLE_SCOPES = {
  global: { label: 'Global', description: 'Available everywhere' },
  collection: { label: 'Collection', description: 'Scoped to a collection/folder' },
  request: { label: 'Request', description: 'Scoped to a single request' },
  local: { label: 'Local', description: 'User-specific override' },
} as const

// Dynamic variables (built-in)
export const DYNAMIC_VARIABLES = {
  $timestamp: { description: 'Current Unix timestamp in seconds', example: '1697000000' },
  $timestampMs: { description: 'Current Unix timestamp in milliseconds', example: '1697000000000' },
  $randomUUID: { description: 'Random UUID v4', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
  $randomInt: { description: 'Random integer 0-1000', example: '42' },
  $randomString: { description: 'Random alphanumeric string', example: 'abc123xyz' },
  $isoTimestamp: { description: 'ISO 8601 timestamp', example: '2023-10-10T12:00:00.000Z' },
  $guid: { description: 'Alias for $randomUUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
} as const

// Common headers
export const COMMON_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'Origin',
  'Referer',
  'User-Agent',
  'X-Requested-With',
] as const

// JSON:API filter operators (FreeFW compatible)
export const JSONAPI_FILTER_OPERATORS = [
  { value: 'eq', label: 'Equals', symbol: '=', needsValue: true },
  { value: 'neq', label: 'Not equals', symbol: '!=', needsValue: true },
  { value: 'gt', label: 'Greater than', symbol: '>', needsValue: true },
  { value: 'gte', label: 'Greater or equal', symbol: '>=', needsValue: true },
  { value: 'ltw', label: 'Less than', symbol: '<', needsValue: true },
  { value: 'ltwe', label: 'Less or equal', symbol: '<=', needsValue: true },
  { value: 'contains', label: 'Contains', symbol: '*x*', needsValue: true },
  { value: 'ncontains', label: 'Not contains', symbol: '!*x*', needsValue: true },
  { value: 'containsb', label: 'Starts with', symbol: 'x*', needsValue: true },
  { value: 'containse', label: 'Ends with', symbol: '*x', needsValue: true },
  { value: 'in', label: 'In list', symbol: '∈', needsValue: true },
  { value: 'nin', label: 'Not in list', symbol: '∉', needsValue: true },
  { value: 'empty', label: 'Is null', symbol: '∅', needsValue: false },
  { value: 'nempty', label: 'Is not null', symbol: '!∅', needsValue: false },
  { value: 'between', label: 'Between', symbol: '↔', needsValue: true },
  { value: 'eqn', label: 'Equals (numeric)', symbol: '=#', needsValue: true },
  { value: 'neqn', label: 'Not equals (numeric)', symbol: '!=#', needsValue: true },
  { value: 'gtn', label: 'Greater than (numeric)', symbol: '>#', needsValue: true },
  { value: 'gten', label: 'Greater or equal (numeric)', symbol: '>=#', needsValue: true },
  { value: 'ltwn', label: 'Less than (numeric)', symbol: '<#', needsValue: true },
  { value: 'ltwen', label: 'Less or equal (numeric)', symbol: '<=#', needsValue: true },
  { value: 'containsn', label: 'Contains (numeric)', symbol: '*#*', needsValue: true },
  { value: 'soundex', label: 'Soundex', symbol: '~', needsValue: true },
] as const

// Common content types
export const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/vnd.api+json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'text/html',
  'text/xml',
] as const
