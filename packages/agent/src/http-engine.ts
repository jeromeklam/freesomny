import { request as undiciRequest, Agent, interceptors, Dispatcher } from 'undici'

const { redirect } = interceptors

export interface RequestPayload {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  timeout: number
  followRedirects: boolean
  verifySsl: boolean
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodyEncoding?: 'base64' | 'utf8'
  time: number
  size: number
}

export async function executeLocalRequest(payload: RequestPayload): Promise<HttpResponse> {
  const startTime = Date.now()

  const agentOptions: { connect?: { rejectUnauthorized: boolean } } = {}
  if (!payload.verifySsl) {
    agentOptions.connect = { rejectUnauthorized: false }
  }

  let dispatcher: Dispatcher = new Agent(agentOptions)
  if (payload.followRedirects) {
    dispatcher = dispatcher.compose(redirect({ maxRedirections: 10 }))
  }

  const requestOptions: {
    method: string
    headers: Record<string, string>
    headersTimeout?: number
    bodyTimeout?: number
    dispatcher: Dispatcher
    body?: string
  } = {
    method: payload.method,
    headers: payload.headers,
    headersTimeout: payload.timeout,
    bodyTimeout: payload.timeout,
    dispatcher,
  }

  if (payload.body && !['GET', 'HEAD'].includes(payload.method)) {
    requestOptions.body = payload.body
  }

  try {
    const response = await undiciRequest(payload.url, requestOptions)

    const responseHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === 'string') responseHeaders[key] = value
      else if (Array.isArray(value)) responseHeaders[key] = value.join(', ')
    }

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
    const contentLength = responseHeaders['content-length']
    const size = contentLength
      ? parseInt(contentLength, 10)
      : bodyEncoding === 'base64'
        ? Math.ceil(responseBody.length * 3 / 4)
        : Buffer.byteLength(responseBody, 'utf8')

    return {
      status: response.statusCode,
      statusText: '',
      headers: responseHeaders,
      body: responseBody,
      bodyEncoding,
      time: endTime - startTime,
      size,
    }
  } catch (error) {
    const endTime = Date.now()
    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      time: endTime - startTime,
      size: 0,
    }
  }
}
