import type { FastifyInstance } from 'fastify'
import type { Folder } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { createFolderSchema, updateFolderSchema, reorderSchema } from '@api-client/shared'
import { parseHeaders, parseQueryParams, parseAuthConfig, stringifyJson } from '../lib/json.js'

export async function folderRoutes(fastify: FastifyInstance) {
  // Get all folders as tree
  fastify.get('/api/folders', async () => {
    const folders = await prisma.folder.findMany({
      include: {
        requests: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Parse JSON fields
    const parsed = folders.map(f => ({
      ...f,
      headers: parseHeaders(f.headers),
      queryParams: parseQueryParams(f.queryParams),
      authConfig: parseAuthConfig(f.authConfig),
      requests: f.requests.map(r => ({
        ...r,
        headers: parseHeaders(r.headers),
        queryParams: parseQueryParams(r.queryParams),
        authConfig: parseAuthConfig(r.authConfig),
      })),
    }))

    // Build tree structure
    const rootFolders = parsed.filter(f => !f.parentId)
    const childMap = new Map<string, typeof parsed>()

    for (const folder of parsed) {
      if (folder.parentId) {
        const children = childMap.get(folder.parentId) || []
        children.push(folder)
        childMap.set(folder.parentId, children)
      }
    }

    function buildTree(folder: (typeof parsed)[0]): unknown {
      const children = childMap.get(folder.id) || []
      return {
        ...folder,
        children: children.map(buildTree),
      }
    }

    return { data: rootFolders.map(buildTree) }
  })

  // Get single folder
  fastify.get<{ Params: { id: string } }>('/api/folders/:id', async (request) => {
    const folder = await prisma.folder.findUnique({
      where: { id: request.params.id },
      include: {
        requests: { orderBy: { sortOrder: 'asc' } },
        children: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!folder) {
      return { error: 'Folder not found' }
    }

    return {
      data: {
        ...folder,
        headers: parseHeaders(folder.headers),
        queryParams: parseQueryParams(folder.queryParams),
        authConfig: parseAuthConfig(folder.authConfig),
      },
    }
  })

  // Create folder
  fastify.post<{ Body: unknown }>('/api/folders', async (request) => {
    const parsed = createFolderSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    const data = parsed.data
    const folder = await prisma.folder.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        headers: stringifyJson(data.headers),
        queryParams: stringifyJson(data.queryParams),
        authType: data.authType,
        authConfig: stringifyJson(data.authConfig),
        preScript: data.preScript,
        postScript: data.postScript,
        baseUrl: data.baseUrl,
        timeout: data.timeout,
        followRedirects: data.followRedirects,
        verifySsl: data.verifySsl,
        proxy: data.proxy,
        sortOrder: data.sortOrder,
      },
    })

    return {
      data: {
        ...folder,
        headers: parseHeaders(folder.headers),
        queryParams: parseQueryParams(folder.queryParams),
        authConfig: parseAuthConfig(folder.authConfig),
      },
    }
  })

  // Update folder
  fastify.put<{ Params: { id: string }; Body: unknown }>('/api/folders/:id', async (request) => {
    const parsed = updateFolderSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.parentId !== undefined) updateData.parentId = data.parentId
    if (data.headers !== undefined) updateData.headers = stringifyJson(data.headers)
    if (data.queryParams !== undefined) updateData.queryParams = stringifyJson(data.queryParams)
    if (data.authType !== undefined) updateData.authType = data.authType
    if (data.authConfig !== undefined) updateData.authConfig = stringifyJson(data.authConfig)
    if (data.preScript !== undefined) updateData.preScript = data.preScript
    if (data.postScript !== undefined) updateData.postScript = data.postScript
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl
    if (data.timeout !== undefined) updateData.timeout = data.timeout
    if (data.followRedirects !== undefined) updateData.followRedirects = data.followRedirects
    if (data.verifySsl !== undefined) updateData.verifySsl = data.verifySsl
    if (data.proxy !== undefined) updateData.proxy = data.proxy
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    const folder = await prisma.folder.update({
      where: { id: request.params.id },
      data: updateData,
    })

    return {
      data: {
        ...folder,
        headers: parseHeaders(folder.headers),
        queryParams: parseQueryParams(folder.queryParams),
        authConfig: parseAuthConfig(folder.authConfig),
      },
    }
  })

  // Delete folder
  fastify.delete<{ Params: { id: string } }>('/api/folders/:id', async (request) => {
    await prisma.folder.delete({
      where: { id: request.params.id },
    })

    return { data: { success: true } }
  })

  // Reorder folder
  fastify.patch<{ Params: { id: string }; Body: unknown }>('/api/folders/:id/reorder', async (request) => {
    const parsed = reorderSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    const folder = await prisma.folder.update({
      where: { id: request.params.id },
      data: {
        parentId: parsed.data.parentId,
        sortOrder: parsed.data.sortOrder,
      },
    })

    return { data: folder }
  })

  // Get resolved settings for a folder (inherited)
  fastify.get<{ Params: { id: string } }>('/api/folders/:id/resolved-settings', async (request) => {
    // Build ancestor chain
    const chain: Array<{ id: string; name: string; parentId: string | null }> = []
    let currentId: string | null = request.params.id

    while (currentId) {
      const dbFolder: Folder | null = await prisma.folder.findUnique({
        where: { id: currentId },
      })
      if (!dbFolder) break
      chain.unshift({
        id: dbFolder.id,
        name: dbFolder.name,
        parentId: dbFolder.parentId,
      })
      currentId = dbFolder.parentId
    }

    // Get full folder data
    const folders = await prisma.folder.findMany({
      where: { id: { in: chain.map(f => f.id) } },
    })

    const folderMap = new Map(folders.map(f => [f.id, f]))

    // Merge settings
    const mergedHeaders = new Map<string, { value: string; source: string }>()
    const mergedParams = new Map<string, { value: string; source: string }>()
    let resolvedAuth = { type: 'inherit', config: {}, source: '' }
    let baseUrl = ''

    for (const { id, name } of chain) {
      const folder = folderMap.get(id)
      if (!folder) continue

      const headers = parseHeaders(folder.headers)
      const params = parseQueryParams(folder.queryParams)

      for (const h of headers) {
        if (h.enabled) mergedHeaders.set(h.key, { value: h.value, source: name })
      }

      for (const p of params) {
        if (p.enabled) mergedParams.set(p.key, { value: p.value, source: name })
      }

      if (folder.authType !== 'inherit') {
        resolvedAuth = {
          type: folder.authType,
          config: parseAuthConfig(folder.authConfig),
          source: name,
        }
      }

      if (folder.baseUrl) {
        baseUrl = baseUrl ? `${baseUrl}/${folder.baseUrl.replace(/^\//, '')}` : folder.baseUrl
      }
    }

    return {
      data: {
        headers: Array.from(mergedHeaders.entries()).map(([key, { value, source }]) => ({ key, value, source })),
        queryParams: Array.from(mergedParams.entries()).map(([key, { value, source }]) => ({ key, value, source })),
        auth: resolvedAuth,
        baseUrl,
        chain: chain.map(f => f.name),
      },
    }
  })
}
