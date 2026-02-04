import type { FastifyInstance } from 'fastify'
import { sendRequestSchema, type AuthType, type AuthConfig } from '@api-client/shared'
import { executeAdHocRequest } from '../services/http-engine.js'
import { prisma } from '../lib/prisma.js'
import { stringifyJson } from '../lib/json.js'
import { getActiveEnvironment } from '../services/environment.js'

export async function sendRoutes(fastify: FastifyInstance) {
  // Send ad-hoc request (not saved)
  fastify.post<{ Body: unknown; Querystring: { environmentId?: string } }>(
    '/api/send',
    async (request) => {
      const parsed = sendRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return { error: 'Validation failed', details: parsed.error.errors }
      }

      const data = parsed.data

      // Convert headers array to record
      const headers: Record<string, string> = {}
      for (const h of data.headers) {
        if (h.enabled) {
          headers[h.key] = h.value
        }
      }

      // Convert query params array to record
      const queryParams: Record<string, string> = {}
      for (const p of data.queryParams) {
        if (p.enabled) {
          queryParams[p.key] = p.value
        }
      }

      // Get environment ID
      let environmentId = request.query.environmentId
      if (!environmentId) {
        const activeEnv = await getActiveEnvironment()
        environmentId = activeEnv?.id
      }

      const response = await executeAdHocRequest(
        data.method,
        data.url,
        headers,
        queryParams,
        data.body || null,
        data.bodyType,
        data.authType as AuthType,
        data.authConfig as AuthConfig,
        data.timeout,
        data.followRedirects,
        data.verifySsl,
        { environmentId }
      )

      // Save to history
      await prisma.historyEntry.create({
        data: {
          method: data.method,
          url: data.url,
          requestHeaders: stringifyJson(headers),
          requestBody: data.body || null,
          responseStatus: response.status,
          responseHeaders: stringifyJson(response.headers),
          responseBody: response.body,
          responseTime: response.time,
          responseSize: response.size,
        },
      })

      return { data: response }
    }
  )
}
