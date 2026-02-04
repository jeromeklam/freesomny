import type { KeyValueItem, AuthType, AuthConfig } from '@api-client/shared'

interface PostmanHeader {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanQuery {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanAuth {
  type: string
  bearer?: Array<{ key: string; value: string }>
  basic?: Array<{ key: string; value: string }>
  apikey?: Array<{ key: string; value: string }>
  oauth2?: Array<{ key: string; value: string }>
}

interface PostmanBody {
  mode?: 'raw' | 'formdata' | 'urlencoded' | 'file'
  raw?: string
  options?: { raw?: { language: string } }
  formdata?: Array<{ key: string; value: string; type: string }>
  urlencoded?: Array<{ key: string; value: string }>
}

interface PostmanRequest {
  method: string
  header?: PostmanHeader[]
  url: {
    raw?: string
    host?: string[]
    path?: string[]
    query?: PostmanQuery[]
  }
  body?: PostmanBody
  auth?: PostmanAuth
  description?: string
}

interface PostmanEvent {
  listen: 'prerequest' | 'test'
  script: {
    exec: string[]
    type: string
  }
}

interface PostmanItem {
  name: string
  description?: string
  request?: PostmanRequest
  item?: PostmanItem[]
  event?: PostmanEvent[]
  auth?: PostmanAuth
}

interface PostmanCollection {
  info: {
    name: string
    description?: string
    schema: string
  }
  item: PostmanItem[]
  variable?: Array<{ key: string; value: string }>
  auth?: PostmanAuth
  event?: PostmanEvent[]
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

interface PostmanImportResult {
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

function convertHeaders(headers: PostmanHeader[] | undefined): KeyValueItem[] {
  if (!headers) return []
  return headers.map((h) => ({
    key: h.key,
    value: h.value,
    description: h.description,
    enabled: !h.disabled,
  }))
}

function convertQueryParams(params: PostmanQuery[] | undefined): KeyValueItem[] {
  if (!params) return []
  return params.map((p) => ({
    key: p.key,
    value: p.value,
    description: p.description,
    enabled: !p.disabled,
  }))
}

function convertAuth(auth: PostmanAuth | undefined): { type: AuthType; config: AuthConfig } {
  if (!auth) return { type: 'inherit', config: {} }

  switch (auth.type) {
    case 'bearer': {
      const token = auth.bearer?.find((b) => b.key === 'token')?.value || ''
      return { type: 'bearer', config: { token } }
    }
    case 'basic': {
      const username = auth.basic?.find((b) => b.key === 'username')?.value || ''
      const password = auth.basic?.find((b) => b.key === 'password')?.value || ''
      return { type: 'basic', config: { username, password } }
    }
    case 'apikey': {
      const key = auth.apikey?.find((a) => a.key === 'key')?.value || ''
      const value = auth.apikey?.find((a) => a.key === 'value')?.value || ''
      const inValue = auth.apikey?.find((a) => a.key === 'in')?.value || 'header'
      return {
        type: 'apikey',
        config: {
          key,
          value,
          addTo: inValue === 'query' ? 'query' : 'header',
        },
      }
    }
    case 'oauth2': {
      const accessToken = auth.oauth2?.find((o) => o.key === 'accessToken')?.value || ''
      return {
        type: 'oauth2',
        config: {
          grantType: 'client_credentials',
          accessTokenUrl: '',
          clientId: '',
          accessToken,
          pkce: false,
          tokenPrefix: 'Bearer',
          headerPrefix: 'Bearer',
          addTo: 'header',
          autoRefresh: true,
        },
      }
    }
    case 'noauth':
      return { type: 'none', config: {} }
    default:
      return { type: 'inherit', config: {} }
  }
}

function convertBody(body: PostmanBody | undefined): { type: string; content: string } {
  if (!body || !body.mode) return { type: 'none', content: '' }

  switch (body.mode) {
    case 'raw':
      const language = body.options?.raw?.language || 'text'
      return {
        type: language === 'json' ? 'json' : 'raw',
        content: body.raw || '',
      }
    case 'urlencoded':
      const params = body.urlencoded?.map((p) => `${p.key}=${p.value}`).join('&') || ''
      return { type: 'urlencoded', content: params }
    case 'formdata':
      return { type: 'form-data', content: JSON.stringify(body.formdata || []) }
    default:
      return { type: 'none', content: '' }
  }
}

function extractScripts(events: PostmanEvent[] | undefined): { pre: string | null; post: string | null } {
  if (!events) return { pre: null, post: null }

  let pre: string | null = null
  let post: string | null = null

  for (const event of events) {
    const script = event.script.exec.join('\n')
    if (event.listen === 'prerequest' && script.trim()) {
      pre = script
    } else if (event.listen === 'test' && script.trim()) {
      post = script
    }
  }

  return { pre, post }
}

function convertRequest(item: PostmanItem): ImportedRequest | null {
  if (!item.request) return null

  const { request } = item
  const url = request.url?.raw || request.url?.path?.join('/') || ''
  const body = convertBody(request.body)
  const auth = convertAuth(request.auth)
  const scripts = extractScripts(item.event)

  return {
    name: item.name,
    description: item.description || request.description || '',
    method: request.method || 'GET',
    url,
    headers: convertHeaders(request.header),
    queryParams: convertQueryParams(request.url?.query),
    bodyType: body.type,
    body: body.content,
    authType: auth.type,
    authConfig: auth.config,
    preScript: scripts.pre,
    postScript: scripts.post,
  }
}

function convertFolder(item: PostmanItem): ImportedFolder {
  const auth = convertAuth(item.auth)
  const scripts = extractScripts(item.event)
  const children: ImportedFolder[] = []
  const requests: ImportedRequest[] = []

  if (item.item) {
    for (const child of item.item) {
      if (child.request) {
        const req = convertRequest(child)
        if (req) requests.push(req)
      } else if (child.item) {
        children.push(convertFolder(child))
      }
    }
  }

  return {
    name: item.name,
    description: item.description || '',
    headers: [],
    queryParams: [],
    authType: auth.type,
    authConfig: auth.config,
    preScript: scripts.pre,
    postScript: scripts.post,
    baseUrl: null,
    children,
    requests,
  }
}

// Extract variables from text using {{VAR}} pattern (Postman style)
function extractVariablesFromText(text: string, variables: Set<string>): void {
  const pattern = /\{\{([^}]+)\}\}/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    variables.add(match[1])
  }
}

function extractVariablesFromRequest(req: PostmanRequest, variables: Set<string>): void {
  if (req.url?.raw) extractVariablesFromText(req.url.raw, variables)
  req.header?.forEach((h) => {
    extractVariablesFromText(h.key, variables)
    extractVariablesFromText(h.value, variables)
  })
  req.url?.query?.forEach((q) => {
    extractVariablesFromText(q.key, variables)
    extractVariablesFromText(q.value, variables)
  })
  if (req.body?.raw) extractVariablesFromText(req.body.raw, variables)
}

function extractVariablesFromItem(item: PostmanItem, variables: Set<string>): void {
  if (item.request) {
    extractVariablesFromRequest(item.request, variables)
  }
  item.event?.forEach((e) => {
    e.script.exec.forEach((line) => extractVariablesFromText(line, variables))
  })
  item.item?.forEach((child) => extractVariablesFromItem(child, variables))
}

function extractVariablesFromCollection(collection: PostmanCollection): ImportedVariable[] {
  const variables = new Set<string>()

  // Extract from all items
  collection.item.forEach((item) => extractVariablesFromItem(item, variables))

  // Extract from collection-level events
  collection.event?.forEach((e) => {
    e.script.exec.forEach((line) => extractVariablesFromText(line, variables))
  })

  // Convert collection.variable to variables (these have values)
  const collectionVars = new Map<string, string>()
  collection.variable?.forEach((v) => {
    collectionVars.set(v.key, v.value)
    variables.add(v.key)
  })

  return Array.from(variables).map((key) => ({
    key,
    value: collectionVars.get(key) || '',
    description: `Imported from ${collection.info.name}`,
    type: 'string' as const,
    isSecret:
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('key'),
  }))
}

export function importPostman(collection: PostmanCollection): PostmanImportResult {
  const auth = convertAuth(collection.auth)
  const scripts = extractScripts(collection.event)
  const children: ImportedFolder[] = []
  const requests: ImportedRequest[] = []

  for (const item of collection.item) {
    if (item.request) {
      const req = convertRequest(item)
      if (req) requests.push(req)
    } else if (item.item) {
      children.push(convertFolder(item))
    }
  }

  const folder: ImportedFolder = {
    name: collection.info.name,
    description: collection.info.description || '',
    headers: [],
    queryParams: [],
    authType: auth.type,
    authConfig: auth.config,
    preScript: scripts.pre,
    postScript: scripts.post,
    baseUrl: null,
    children,
    requests,
  }

  // Extract variables from the collection
  const extractedVars = extractVariablesFromCollection(collection)
  const environments: ImportedEnvironment[] = []

  if (extractedVars.length > 0) {
    environments.push({
      name: `${collection.info.name} - Variables`,
      description: `Variables extracted from ${collection.info.name} collection`,
      variables: extractedVars,
    })
  }

  return { folder, environments }
}
