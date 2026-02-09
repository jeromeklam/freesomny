import type { HttpResponse, PreparedRequest } from '@api-client/shared'

export async function executeBrowserFetch(prepared: PreparedRequest): Promise<HttpResponse> {
  const startTime = Date.now()

  try {
    const fetchInit: RequestInit = {
      method: prepared.method,
      headers: prepared.headers,
    }

    // Add body for non-GET/HEAD requests
    if (prepared.body && !['GET', 'HEAD'].includes(prepared.method)) {
      fetchInit.body = prepared.body
    }

    const response = await fetch(prepared.url, fetchInit)

    // Convert headers to Record
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

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
      const buffer = await response.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      responseBody = btoa(binary)
      bodyEncoding = 'base64'
    } else {
      responseBody = await response.text()
    }

    const endTime = Date.now()
    const contentLength = responseHeaders['content-length']
    const size = contentLength
      ? parseInt(contentLength, 10)
      : new Blob([responseBody]).size

    return {
      status: response.status,
      statusText: response.statusText,
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
      body: JSON.stringify({
        error: errorMessage,
        hint: 'This may be a CORS error. The target server must include Access-Control-Allow-Origin headers.',
      }),
      time: endTime - startTime,
      size: 0,
    }
  }
}
