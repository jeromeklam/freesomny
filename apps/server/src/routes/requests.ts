import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { createRequestSchema, updateRequestSchema, reorderSchema } from '@api-client/shared'
import { parseHeaders, parseQueryParams, parseAuthConfig, stringifyJson } from '../lib/json.js'
import { resolveRequest, getResolvedView } from '../services/inheritance.js'
import { executeRequest } from '../services/http-engine.js'
import { resolveVariables, getActiveEnvironment } from '../services/environment.js'
import { executeScripts } from '../scripting/sandbox.js'

export async function requestRoutes(fastify: FastifyInstance) {
  // Get single request
  fastify.get<{ Params: { id: string } }>('/api/requests/:id', async (request) => {
    const req = await prisma.request.findUnique({
      where: { id: request.params.id },
    })

    if (!req) {
      return { error: 'Request not found' }
    }

    return {
      data: {
        ...req,
        headers: parseHeaders(req.headers),
        queryParams: parseQueryParams(req.queryParams),
        authConfig: parseAuthConfig(req.authConfig),
      },
    }
  })

  // Create request
  fastify.post<{ Body: unknown }>('/api/requests', async (request) => {
    const parsed = createRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    const data = parsed.data
    const req = await prisma.request.create({
      data: {
        name: data.name,
        description: data.description,
        method: data.method,
        url: data.url,
        queryParams: stringifyJson(data.queryParams),
        headers: stringifyJson(data.headers),
        bodyType: data.bodyType,
        body: data.body,
        bodyDescription: data.bodyDescription,
        authType: data.authType,
        authConfig: stringifyJson(data.authConfig),
        preScript: data.preScript,
        postScript: data.postScript,
        timeout: data.timeout,
        followRedirects: data.followRedirects,
        verifySsl: data.verifySsl,
        proxy: data.proxy,
        folderId: data.folderId,
        sortOrder: data.sortOrder,
      },
    })

    return {
      data: {
        ...req,
        headers: parseHeaders(req.headers),
        queryParams: parseQueryParams(req.queryParams),
        authConfig: parseAuthConfig(req.authConfig),
      },
    }
  })

  // Update request
  fastify.put<{ Params: { id: string }; Body: unknown }>('/api/requests/:id', async (request) => {
    const parsed = updateRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.method !== undefined) updateData.method = data.method
    if (data.url !== undefined) updateData.url = data.url
    if (data.queryParams !== undefined) updateData.queryParams = stringifyJson(data.queryParams)
    if (data.headers !== undefined) updateData.headers = stringifyJson(data.headers)
    if (data.bodyType !== undefined) updateData.bodyType = data.bodyType
    if (data.body !== undefined) updateData.body = data.body
    if (data.bodyDescription !== undefined) updateData.bodyDescription = data.bodyDescription
    if (data.authType !== undefined) updateData.authType = data.authType
    if (data.authConfig !== undefined) updateData.authConfig = stringifyJson(data.authConfig)
    if (data.preScript !== undefined) updateData.preScript = data.preScript
    if (data.postScript !== undefined) updateData.postScript = data.postScript
    if (data.timeout !== undefined) updateData.timeout = data.timeout
    if (data.followRedirects !== undefined) updateData.followRedirects = data.followRedirects
    if (data.verifySsl !== undefined) updateData.verifySsl = data.verifySsl
    if (data.proxy !== undefined) updateData.proxy = data.proxy
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    const req = await prisma.request.update({
      where: { id: request.params.id },
      data: updateData,
    })

    return {
      data: {
        ...req,
        headers: parseHeaders(req.headers),
        queryParams: parseQueryParams(req.queryParams),
        authConfig: parseAuthConfig(req.authConfig),
      },
    }
  })

  // Delete request
  fastify.delete<{ Params: { id: string } }>('/api/requests/:id', async (request) => {
    await prisma.request.delete({
      where: { id: request.params.id },
    })

    return { data: { success: true } }
  })

  // Reorder request (move to different folder or change sort order)
  fastify.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/requests/:id/reorder',
    async (request) => {
      const parsed = reorderSchema.safeParse(request.body)
      if (!parsed.success) {
        return { error: 'Validation failed', details: parsed.error.errors }
      }

      // parentId in reorder schema maps to folderId for requests
      const req = await prisma.request.update({
        where: { id: request.params.id },
        data: {
          folderId: parsed.data.parentId as string, // requests must have a folderId
          sortOrder: parsed.data.sortOrder,
        },
      })

      return {
        data: {
          ...req,
          headers: parseHeaders(req.headers),
          queryParams: parseQueryParams(req.queryParams),
          authConfig: parseAuthConfig(req.authConfig),
        },
      }
    }
  )

  // Get resolved view
  fastify.get<{ Params: { id: string }; Querystring: { environmentId?: string } }>(
    '/api/requests/:id/resolved',
    async (request) => {
      try {
        const resolved = await getResolvedView(request.params.id)
        return { data: resolved }
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to resolve request' }
      }
    }
  )

  // Send request
  fastify.post<{ Params: { id: string }; Querystring: { environmentId?: string } }>(
    '/api/requests/:id/send',
    async (request) => {
      try {
        // Resolve request with inheritance
        const resolved = await resolveRequest(request.params.id)

        // Get environment variables
        let environmentId = request.query.environmentId
        if (!environmentId) {
          const activeEnv = await getActiveEnvironment()
          environmentId = activeEnv?.id
        }

        const envVars = environmentId
          ? await resolveVariables(environmentId)
          : new Map<string, { key: string; value: string; source: 'team' | 'local' | 'dynamic'; isSecret: boolean }>()

        // Convert to simple map for scripts
        const envMap = new Map<string, string>()
        for (const [key, { value }] of envVars) {
          envMap.set(key, value)
        }

        // Run pre-request scripts
        let currentRequest = {
          url: resolved.url,
          method: resolved.method,
          headers: { ...resolved.headers },
          body: resolved.body,
        }

        const preScriptResult = await executeScripts(
          resolved.preScripts,
          { env: envMap, request: currentRequest },
          true
        )

        // Check if request was skipped
        if (preScriptResult.skip) {
          return {
            data: {
              skipped: true,
              scripts: {
                pre: {
                  logs: preScriptResult.logs,
                  errors: preScriptResult.errors,
                },
              },
            },
          }
        }

        // Apply script modifications
        if (preScriptResult.requestModifications) {
          const mods = preScriptResult.requestModifications
          if (mods.url) currentRequest.url = mods.url
          if (mods.method) currentRequest.method = mods.method
          if (mods.headers) currentRequest.headers = { ...currentRequest.headers, ...mods.headers }
          if (mods.body !== undefined) currentRequest.body = mods.body
        }

        // Execute HTTP request
        const httpResponse = await executeRequest(
          {
            ...resolved,
            url: currentRequest.url,
            method: currentRequest.method,
            headers: currentRequest.headers,
            body: currentRequest.body,
          },
          { environmentId }
        )

        // Run post-response scripts
        const postScriptResult = await executeScripts(
          resolved.postScripts,
          {
            env: envMap,
            response: {
              status: httpResponse.status,
              statusText: httpResponse.statusText,
              headers: httpResponse.headers,
              body: httpResponse.body,
              time: httpResponse.time,
              size: httpResponse.size,
            },
          },
          false
        )

        // Apply environment updates from scripts
        if (environmentId) {
          for (const [key, value] of preScriptResult.envUpdates) {
            if (value === null) {
              await prisma.localOverride.deleteMany({
                where: { environmentId, key, userId: 'local' },
              })
            } else {
              await prisma.localOverride.upsert({
                where: { environmentId_key_userId: { environmentId, key, userId: 'local' } },
                create: { environmentId, key, value, userId: 'local' },
                update: { value },
              })
            }
          }
          for (const [key, value] of postScriptResult.envUpdates) {
            if (value === null) {
              await prisma.localOverride.deleteMany({
                where: { environmentId, key, userId: 'local' },
              })
            } else {
              await prisma.localOverride.upsert({
                where: { environmentId_key_userId: { environmentId, key, userId: 'local' } },
                create: { environmentId, key, value, userId: 'local' },
                update: { value },
              })
            }
          }
        }

        // Save to history
        await prisma.historyEntry.create({
          data: {
            method: currentRequest.method,
            url: currentRequest.url,
            requestHeaders: stringifyJson(currentRequest.headers),
            requestBody: currentRequest.body,
            responseStatus: httpResponse.status,
            responseHeaders: stringifyJson(httpResponse.headers),
            responseBody: httpResponse.body,
            responseTime: httpResponse.time,
            responseSize: httpResponse.size,
          },
        })

        return {
          data: {
            response: httpResponse,
            scripts: {
              pre: {
                logs: preScriptResult.logs,
                errors: preScriptResult.errors,
              },
              post: {
                logs: postScriptResult.logs,
                errors: postScriptResult.errors,
                tests: postScriptResult.tests,
              },
            },
          },
        }
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to send request' }
      }
    }
  )
}
