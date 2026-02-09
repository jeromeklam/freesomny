import { z } from 'zod'

// Key-value item schema
export const keyValueItemSchema = z.object({
  key: z.string(),
  value: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
})

// Auth type schema
export const authTypeSchema = z.enum([
  'inherit',
  'none',
  'bearer',
  'basic',
  'apikey',
  'jwt',
  'jwt_freefw',
  'oauth2',
  'openid',
  'hawk',
])

// Auth config schemas
export const authBearerSchema = z.object({
  token: z.string(),
})

export const authBasicSchema = z.object({
  username: z.string(),
  password: z.string(),
})

export const authApiKeySchema = z.object({
  key: z.string(),
  value: z.string(),
  addTo: z.enum(['header', 'query', 'cookie']),
})

export const authJwtSchema = z.object({
  algorithm: z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']),
  secret: z.string(),
  payload: z.string(),
  headerPrefix: z.string().default('Bearer'),
  addTo: z.enum(['header', 'query']).default('header'),
  queryParamName: z.string().optional(),
})

export const authJwtFreefwSchema = z.object({
  token: z.string(),
})

export const authOAuth2Schema = z.object({
  grantType: z.enum(['authorization_code', 'client_credentials', 'password', 'implicit', 'refresh_token']),
  accessTokenUrl: z.string(),
  authUrl: z.string().optional(),
  clientId: z.string(),
  clientSecret: z.string().optional(),
  scope: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  redirectUri: z.string().optional(),
  audience: z.string().optional(),
  state: z.string().optional(),
  pkce: z.boolean().default(false),
  codeChallengeMethod: z.enum(['S256', 'plain']).optional(),
  tokenPrefix: z.string().default('Bearer'),
  headerPrefix: z.string().default('Bearer'),
  addTo: z.enum(['header', 'query']).default('header'),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  autoRefresh: z.boolean().default(true),
})

export const authOpenIdSchema = z.object({
  discoveryUrl: z.string(),
  clientId: z.string(),
  clientSecret: z.string().optional(),
  scope: z.string().default('openid'),
  redirectUri: z.string().optional(),
  responseType: z.string().default('code'),
  pkce: z.boolean().default(true),
  codeChallengeMethod: z.enum(['S256', 'plain']).optional(),
  audience: z.string().optional(),
  authorizationEndpoint: z.string().optional(),
  tokenEndpoint: z.string().optional(),
  userinfoEndpoint: z.string().optional(),
  jwksUri: z.string().optional(),
  accessToken: z.string().optional(),
  idToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  autoRefresh: z.boolean().default(true),
  tokenPrefix: z.string().default('Bearer'),
  addTo: z.enum(['header', 'query']).default('header'),
})

export const authHawkSchema = z.object({
  authId: z.string(),
  authKey: z.string(),
  algorithm: z.enum(['sha256', 'sha1']).default('sha256'),
  ext: z.string().optional(),
  app: z.string().optional(),
  dlg: z.string().optional(),
  nonce: z.string().optional(),
  timestamp: z.string().optional(),
  includePayloadHash: z.boolean().default(false),
})

export const authConfigSchema = z.union([
  z.object({}),
  authBearerSchema,
  authBasicSchema,
  authApiKeySchema,
  authJwtSchema,
  authJwtFreefwSchema,
  authOAuth2Schema,
  authOpenIdSchema,
  authHawkSchema,
])

// Inherit type for boolean-like fields
export const inheritBoolSchema = z.enum(['inherit', 'true', 'false']).default('inherit')

// HTTP methods
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

// Body types
export const bodyTypeSchema = z.enum(['none', 'json', 'jsonapi', 'form-data', 'urlencoded', 'raw', 'binary'])

// Folder schemas
export const createFolderSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  parentId: z.string().nullable().default(null),
  headers: z.array(keyValueItemSchema).default([]),
  queryParams: z.array(keyValueItemSchema).default([]),
  authType: authTypeSchema.default('inherit'),
  authConfig: z.record(z.unknown()).default({}),
  preScript: z.string().nullable().default(null),
  postScript: z.string().nullable().default(null),
  baseUrl: z.string().nullable().default(null),
  timeout: z.number().nullable().default(null),
  followRedirects: inheritBoolSchema,
  verifySsl: inheritBoolSchema,
  proxy: z.string().nullable().default(null),
  sortOrder: z.number().default(0),
})

export const updateFolderSchema = createFolderSchema.partial()

// Request schemas
export const createRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  method: httpMethodSchema.default('GET'),
  url: z.string().default(''),
  queryParams: z.array(keyValueItemSchema).default([]),
  headers: z.array(keyValueItemSchema).default([]),
  bodyType: bodyTypeSchema.default('none'),
  body: z.string().default(''),
  bodyDescription: z.string().default(''),
  authType: authTypeSchema.default('inherit'),
  authConfig: z.record(z.unknown()).default({}),
  preScript: z.string().nullable().default(null),
  postScript: z.string().nullable().default(null),
  timeout: z.number().nullable().default(null),
  followRedirects: inheritBoolSchema,
  verifySsl: inheritBoolSchema,
  proxy: z.string().nullable().default(null),
  isFavorite: z.boolean().default(false),
  folderId: z.string(),
  sortOrder: z.number().default(0),
})

export const updateRequestSchema = createRequestSchema.partial().omit({ folderId: true })

// Environment schemas
export const createEnvironmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  isActive: z.boolean().default(false),
})

export const updateEnvironmentSchema = createEnvironmentSchema.partial()

// Variable schemas
export const variableTypeSchema = z.enum(['string', 'secret', 'dynamic'])
export const variableScopeSchema = z.enum(['global', 'collection', 'request', 'local'])
export const variableCategorySchema = z.enum(['input', 'generated'])

export const createVariableSchema = z.object({
  key: z.string().min(1),
  value: z.string().default(''),
  description: z.string().default(''),
  type: variableTypeSchema.default('string'),
  scope: variableScopeSchema.default('global'),
  isSecret: z.boolean().default(false),
  category: variableCategorySchema.default('input'),
})

export const updateVariableSchema = createVariableSchema.partial()

// Local override schemas
export const createOverrideSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().default(''),
})

export const updateOverrideSchema = createOverrideSchema.partial()

// Send request schema (for ad-hoc requests)
export const sendRequestSchema = z.object({
  method: httpMethodSchema,
  url: z.string().min(1),
  headers: z.array(keyValueItemSchema).default([]),
  queryParams: z.array(keyValueItemSchema).default([]),
  bodyType: bodyTypeSchema.default('none'),
  body: z.string().default(''),
  authType: authTypeSchema.default('none'),
  authConfig: z.record(z.unknown()).default({}),
  timeout: z.number().default(30000),
  followRedirects: z.boolean().default(true),
  verifySsl: z.boolean().default(true),
  proxy: z.string().nullable().default(null),
})

// Reorder schema
export const reorderSchema = z.object({
  parentId: z.string().nullable(),
  sortOrder: z.number(),
})

// Import schemas
export const importPostmanSchema = z.object({
  collection: z.unknown(),
})

export const importCurlSchema = z.object({
  curl: z.string(),
  folderId: z.string().optional(),
})

export const importOpenApiSchema = z.object({
  spec: z.unknown(),
})
