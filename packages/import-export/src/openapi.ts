import type { KeyValueItem, AuthType, AuthConfig } from '@api-client/shared'
import YAML from 'yaml'
import { isJsonApiBody } from './jsonapi-detect.js'
import { extractCommonParams } from './extract-common.js'

interface OpenAPIParameter {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  description?: string
  required?: boolean
  schema?: { type: string; default?: unknown }
}

interface OpenAPIRequestBody {
  description?: string
  content?: Record<
    string,
    {
      schema?: unknown
      example?: unknown
    }
  >
}

interface OpenAPIOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
  responses?: Record<string, unknown>
  security?: Array<Record<string, string[]>>
  'x-request-settings'?: {
    auth?: { type: string; config?: unknown }
    preScript?: string
    postScript?: string
  }
}

interface OpenAPIPathItem {
  summary?: string
  description?: string
  get?: OpenAPIOperation
  post?: OpenAPIOperation
  put?: OpenAPIOperation
  patch?: OpenAPIOperation
  delete?: OpenAPIOperation
  head?: OpenAPIOperation
  options?: OpenAPIOperation
  'x-folder-settings'?: {
    headers?: KeyValueItem[]
    queryParams?: KeyValueItem[]
    auth?: { type: string; config?: unknown }
    baseUrl?: string
    preScript?: string
    postScript?: string
  }
}

interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  scheme?: string
  bearerFormat?: string
  name?: string
  in?: 'query' | 'header' | 'cookie'
  flows?: {
    clientCredentials?: { tokenUrl: string; scopes?: Record<string, string> }
    authorizationCode?: {
      authorizationUrl: string
      tokenUrl: string
      scopes?: Record<string, string>
    }
  }
  openIdConnectUrl?: string
}

interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    description?: string
    version: string
  }
  servers?: Array<{ url: string; description?: string }>
  paths: Record<string, OpenAPIPathItem>
  components?: {
    securitySchemes?: Record<string, OpenAPISecurityScheme>
  }
  security?: Array<Record<string, string[]>>
  'x-environments'?: Array<{
    name: string
    description?: string
    variables: Array<{ key: string; value: string; description?: string; type?: string; secret?: boolean }>
  }>
  'x-folder-tree'?: Array<{
    name: string
    description?: string
    settings?: Record<string, unknown>
    children?: unknown[]
    requests?: string[]
  }>
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

interface ImportedEnvironment {
  name: string
  description: string
  variables: Array<{
    key: string
    value: string
    description: string
    type: 'string' | 'secret'
    isSecret: boolean
  }>
}

function parseOpenAPISpec(input: string | object): OpenAPISpec {
  if (typeof input === 'string') {
    // Try JSON first
    try {
      return JSON.parse(input) as OpenAPISpec
    } catch {
      // Try YAML
      return YAML.parse(input) as OpenAPISpec
    }
  }
  return input as OpenAPISpec
}

function convertSecurityScheme(scheme: OpenAPISecurityScheme): { type: AuthType; config: AuthConfig } {
  switch (scheme.type) {
    case 'http':
      if (scheme.scheme === 'bearer') {
        return { type: 'bearer', config: { token: '' } }
      }
      if (scheme.scheme === 'basic') {
        return { type: 'basic', config: { username: '', password: '' } }
      }
      break
    case 'apiKey':
      return {
        type: 'apikey',
        config: {
          key: scheme.name || '',
          value: '',
          addTo: scheme.in === 'query' ? 'query' : scheme.in === 'cookie' ? 'cookie' : 'header',
        },
      }
    case 'oauth2':
      if (scheme.flows?.clientCredentials) {
        return {
          type: 'oauth2',
          config: {
            grantType: 'client_credentials',
            accessTokenUrl: scheme.flows.clientCredentials.tokenUrl,
            clientId: '',
            scope: Object.keys(scheme.flows.clientCredentials.scopes || {}).join(' '),
            pkce: false,
            tokenPrefix: 'Bearer',
            headerPrefix: 'Bearer',
            addTo: 'header',
            autoRefresh: true,
          },
        }
      }
      if (scheme.flows?.authorizationCode) {
        return {
          type: 'oauth2',
          config: {
            grantType: 'authorization_code',
            accessTokenUrl: scheme.flows.authorizationCode.tokenUrl,
            authUrl: scheme.flows.authorizationCode.authorizationUrl,
            clientId: '',
            scope: Object.keys(scheme.flows.authorizationCode.scopes || {}).join(' '),
            pkce: false,
            tokenPrefix: 'Bearer',
            headerPrefix: 'Bearer',
            addTo: 'header',
            autoRefresh: true,
          },
        }
      }
      break
    case 'openIdConnect':
      return {
        type: 'openid',
        config: {
          discoveryUrl: scheme.openIdConnectUrl || '',
          clientId: '',
          scope: 'openid',
          pkce: true,
          autoRefresh: true,
          tokenPrefix: 'Bearer',
          addTo: 'header',
        },
      }
  }

  return { type: 'none', config: {} }
}

function extractParametersAsHeaders(params: OpenAPIParameter[] | undefined): KeyValueItem[] {
  if (!params) return []
  return params
    .filter((p) => p.in === 'header')
    .map((p) => ({
      key: p.name,
      value: String(p.schema?.default || ''),
      description: p.description,
      enabled: true,
    }))
}

function extractParametersAsQuery(params: OpenAPIParameter[] | undefined): KeyValueItem[] {
  if (!params) return []
  return params
    .filter((p) => p.in === 'query')
    .map((p) => ({
      key: p.name,
      value: String(p.schema?.default || ''),
      description: p.description,
      enabled: true,
    }))
}

function getRequestBody(requestBody: OpenAPIRequestBody | undefined): { type: string; content: string } {
  if (!requestBody?.content) return { type: 'none', content: '' }

  // Check for JSON:API content type first
  const jsonApiContent = requestBody.content['application/vnd.api+json']
  if (jsonApiContent) {
    const example = jsonApiContent.example
    return {
      type: 'jsonapi',
      content: example ? JSON.stringify(example, null, 2) : '{}',
    }
  }

  const jsonContent = requestBody.content['application/json']
  if (jsonContent) {
    const example = jsonContent.example
    const content = example ? JSON.stringify(example, null, 2) : '{}'
    // Auto-detect JSON:API from body content
    if (isJsonApiBody(content)) {
      return { type: 'jsonapi', content }
    }
    return { type: 'json', content }
  }

  const formContent = requestBody.content['application/x-www-form-urlencoded']
  if (formContent) {
    return { type: 'urlencoded', content: '' }
  }

  const multipartContent = requestBody.content['multipart/form-data']
  if (multipartContent) {
    return { type: 'form-data', content: '' }
  }

  return { type: 'raw', content: '' }
}

export function importOpenAPI(input: string | object): {
  folders: ImportedFolder[]
  environments: ImportedEnvironment[]
} {
  const spec = parseOpenAPISpec(input)

  // Group operations by tag
  const tagFolders = new Map<string, ImportedRequest[]>()
  const untaggedRequests: ImportedRequest[] = []

  const baseUrl = spec.servers?.[0]?.url || ''

  // Process paths
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

    for (const method of methods) {
      const operation = pathItem[method]
      if (!operation) continue

      const body = getRequestBody(operation.requestBody)

      const request: ImportedRequest = {
        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        description: operation.description || '',
        method: method.toUpperCase(),
        url: path,
        headers: extractParametersAsHeaders(operation.parameters),
        queryParams: extractParametersAsQuery(operation.parameters),
        bodyType: body.type,
        body: body.content,
        authType: operation['x-request-settings']?.auth?.type as AuthType || 'inherit',
        authConfig: (operation['x-request-settings']?.auth?.config as AuthConfig) || {},
        preScript: operation['x-request-settings']?.preScript || null,
        postScript: operation['x-request-settings']?.postScript || null,
      }

      const tags = operation.tags || ['Untagged']
      for (const tag of tags) {
        if (!tagFolders.has(tag)) {
          tagFolders.set(tag, [])
        }
        tagFolders.get(tag)!.push(request)
      }
    }
  }

  // Convert tag groups to folders
  const folders: ImportedFolder[] = []

  // Check for x-folder-tree (our native format)
  if (spec['x-folder-tree']) {
    // Use native folder structure
    const convertNativeFolder = (item: {
      name: string
      description?: string
      settings?: Record<string, unknown>
      children?: unknown[]
      requests?: string[]
    }): ImportedFolder => {
      const settings = item.settings || {}
      return {
        name: item.name,
        description: item.description || '',
        headers: (settings.headers as KeyValueItem[]) || [],
        queryParams: (settings.queryParams as KeyValueItem[]) || [],
        authType: ((settings.auth as { type?: string })?.type as AuthType) || 'inherit',
        authConfig: ((settings.auth as { config?: AuthConfig })?.config as AuthConfig) || {},
        preScript: (settings.preScript as string) || null,
        postScript: (settings.postScript as string) || null,
        baseUrl: (settings.baseUrl as string) || null,
        children: ((item.children as Array<typeof item>) || []).map(convertNativeFolder),
        requests: [], // TODO: link by operationId
      }
    }

    for (const item of spec['x-folder-tree']) {
      folders.push(convertNativeFolder(item))
    }
  } else {
    // Create folders from tags
    for (const [tag, requests] of tagFolders) {
      folders.push({
        name: tag,
        description: '',
        headers: [],
        queryParams: [],
        authType: 'inherit',
        authConfig: {},
        preScript: null,
        postScript: null,
        baseUrl: null,
        children: [],
        requests,
      })
    }
  }

  // If no folders but we have requests, create a root folder
  if (folders.length === 0 && untaggedRequests.length > 0) {
    folders.push({
      name: spec.info.title || 'Imported API',
      description: spec.info.description || '',
      headers: [],
      queryParams: [],
      authType: 'none',
      authConfig: {},
      preScript: null,
      postScript: null,
      baseUrl,
      children: [],
      requests: untaggedRequests,
    })
  }

  // Process environments
  const environments: ImportedEnvironment[] = []

  if (spec['x-environments']) {
    for (const env of spec['x-environments']) {
      environments.push({
        name: env.name,
        description: env.description || '',
        variables: env.variables.map((v) => ({
          key: v.key,
          value: v.value,
          description: v.description || '',
          type: v.secret ? 'secret' : 'string',
          isSecret: v.secret || false,
        })),
      })
    }
  }

  // Extract common headers/queryParams to folder level
  for (const folder of folders) {
    extractCommonParams(folder)
  }

  return { folders, environments }
}

export function exportOpenAPI(
  folders: ImportedFolder[],
  environments: ImportedEnvironment[],
  info: { title: string; description?: string; version?: string }
): OpenAPISpec {
  const paths: Record<string, OpenAPIPathItem> = {}
  const folderTree: OpenAPISpec['x-folder-tree'] = []

  const processFolder = (folder: ImportedFolder, basePath: string = ''): void => {
    const folderNode: NonNullable<OpenAPISpec['x-folder-tree']>[0] = {
      name: folder.name,
      description: folder.description,
      settings: {
        headers: folder.headers,
        queryParams: folder.queryParams,
        auth: { type: folder.authType, config: folder.authConfig },
        baseUrl: folder.baseUrl,
        preScript: folder.preScript,
        postScript: folder.postScript,
      },
      children: [],
      requests: [],
    }

    for (const request of folder.requests) {
      const path = basePath + (request.url.startsWith('/') ? request.url : '/' + request.url)
      const method = request.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

      if (!paths[path]) {
        paths[path] = {}
      }

      const parameters: OpenAPIParameter[] = [
        ...request.headers.map((h) => ({
          name: h.key,
          in: 'header' as const,
          description: h.description,
          schema: { type: 'string' },
        })),
        ...request.queryParams.map((p) => ({
          name: p.key,
          in: 'query' as const,
          description: p.description,
          schema: { type: 'string' },
        })),
      ]

      let requestBody: OpenAPIRequestBody | undefined
      if (request.body && request.bodyType !== 'none') {
        const contentType =
          request.bodyType === 'jsonapi'
            ? 'application/vnd.api+json'
            : request.bodyType === 'json'
            ? 'application/json'
            : request.bodyType === 'urlencoded'
            ? 'application/x-www-form-urlencoded'
            : request.bodyType === 'form-data'
            ? 'multipart/form-data'
            : 'text/plain'

        requestBody = {
          description: '',
          content: {
            [contentType]: {
              example: request.bodyType === 'json' || request.bodyType === 'jsonapi'
                ? JSON.parse(request.body || '{}')
                : request.body,
            },
          },
        }
      }

      paths[path][method] = {
        operationId: request.name.replace(/[^a-zA-Z0-9]/g, ''),
        summary: request.name,
        description: request.description,
        tags: [folder.name],
        parameters,
        requestBody,
        responses: { '200': { description: 'Success' } },
        'x-request-settings': {
          auth: { type: request.authType, config: request.authConfig },
          preScript: request.preScript || undefined,
          postScript: request.postScript || undefined,
        },
      }

      folderNode.requests!.push(request.name.replace(/[^a-zA-Z0-9]/g, ''))
    }

    for (const child of folder.children) {
      const childPath = basePath + (folder.baseUrl || '')
      processFolder(child, childPath)
      ;(folderNode.children as typeof folderTree).push({
        name: child.name,
        description: child.description,
      })
    }

    folderTree.push(folderNode)
  }

  for (const folder of folders) {
    processFolder(folder)
  }

  return {
    openapi: '3.1.0',
    info: {
      title: info.title,
      description: info.description,
      version: info.version || '1.0.0',
    },
    paths,
    'x-environments': environments.map((env) => ({
      name: env.name,
      description: env.description,
      variables: env.variables.map((v) => ({
        key: v.key,
        value: v.value,
        description: v.description,
        type: v.type,
        secret: v.isSecret,
      })),
    })),
    'x-folder-tree': folderTree,
  }
}
