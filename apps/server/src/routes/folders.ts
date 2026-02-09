import type { FastifyInstance } from 'fastify'
import type { Folder } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { createFolderSchema, updateFolderSchema, reorderSchema } from '@api-client/shared'
import { parseHeaders, parseQueryParams, parseAuthConfig, stringifyJson } from '../lib/json.js'
import { getInheritedContextForFolder } from '../services/inheritance.js'
import { extractAuthFromHeaders } from '@api-client/import-export'
import { optionalAuth, requireAuth, getCurrentUserId } from '../lib/auth.js'
import type { KeyValueItem } from '@api-client/shared'
import { z } from 'zod'

/** Authorization is managed by the Auth tab — strip from raw headers unless authType is 'none' (user manages manually) */
function stripAuthHeader(headers: KeyValueItem[], authType: string): KeyValueItem[] {
  if (authType === 'none') return headers
  return headers.filter(h => h.key.toLowerCase() !== 'authorization')
}

const shareFolderSchema = z.object({
  email: z.string().email(),
  permission: z.enum(['read', 'write', 'admin']).default('read'),
})

export async function folderRoutes(fastify: FastifyInstance) {
  // Get all folders as tree
  fastify.get('/api/folders', { preHandler: [optionalAuth] }, async (request) => {
    const userId = getCurrentUserId(request)

    // Build where clause: if authenticated, show owned + shared + group folders
    // If not authenticated, show all folders (backward compatibility)
    let whereClause = {}
    if (userId) {
      // Get folder IDs that are shared with the user
      const sharedFolders = await prisma.folderShare.findMany({
        where: { userId },
        select: { folderId: true },
      })
      const sharedFolderIds = sharedFolders.map(sf => sf.folderId)

      // Get groups the user is a member of
      const groupMemberships = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      })
      const groupIds = groupMemberships.map(gm => gm.groupId)

      whereClause = {
        OR: [
          { userId },
          { id: { in: sharedFolderIds } },
          { groupId: { in: groupIds } },
        ],
      }
    }

    const folders = await prisma.folder.findMany({
      where: whereClause,
      include: {
        requests: {
          orderBy: { sortOrder: 'asc' },
        },
        group: {
          select: { id: true, name: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Parse JSON fields and strip stale Authorization headers
    const parsed = folders.map(f => ({
      ...f,
      headers: stripAuthHeader(parseHeaders(f.headers), f.authType),
      queryParams: parseQueryParams(f.queryParams),
      authConfig: parseAuthConfig(f.authConfig),
      requests: f.requests.map(r => ({
        ...r,
        isFavorite: 'isFavorite' in r ? r.isFavorite : false,
        headers: stripAuthHeader(parseHeaders(r.headers), r.authType),
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
        group: { select: { id: true, name: true } },
      },
    })

    if (!folder) {
      return { error: 'Folder not found' }
    }

    return {
      data: {
        ...folder,
        headers: stripAuthHeader(parseHeaders(folder.headers), folder.authType),
        queryParams: parseQueryParams(folder.queryParams),
        authConfig: parseAuthConfig(folder.authConfig),
      },
    }
  })

  // Create folder
  fastify.post<{ Body: unknown }>('/api/folders', { preHandler: [optionalAuth] }, async (request) => {
    const parsed = createFolderSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    const userId = getCurrentUserId(request)
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
        userId: userId,
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

    // Auto-sync Authorization header ↔ Auth config
    if (data.headers && Array.isArray(data.headers)) {
      const currentAuthType = (data.authType as string) ?? (await prisma.folder.findUnique({ where: { id: request.params.id }, select: { authType: true } }))?.authType ?? 'inherit'
      if (currentAuthType === 'inherit') {
        // No explicit auth — try to detect from Authorization header
        const extracted = extractAuthFromHeaders(data.headers)
        if (extracted.authType !== 'none') {
          updateData.headers = stringifyJson(extracted.headers)
          updateData.authType = extracted.authType
          updateData.authConfig = stringifyJson(extracted.authConfig)
        }
      } else if (currentAuthType !== 'none') {
        // Auth is configured (not 'none') — strip Authorization header
        const headersArr = data.headers as Array<{ key: string; value: string; description?: string; enabled: boolean }>
        const filtered = headersArr.filter((h) => h.key.toLowerCase() !== 'authorization')
        if (filtered.length !== headersArr.length) {
          updateData.headers = stringifyJson(filtered)
        }
      }
      // When currentAuthType === 'none': pass headers through as-is (user manages manually)
    }

    // When auth type is explicitly changed, also strip Authorization from existing headers
    if (data.authType && data.authType !== 'inherit' && data.authType !== 'none' && !data.headers) {
      const currentHeaders = JSON.parse(
        (await prisma.folder.findUnique({ where: { id: request.params.id }, select: { headers: true } }))?.headers ?? '[]'
      )
      const filtered = (currentHeaders as Array<{ key: string; value: string; description?: string; enabled: boolean }>)
        .filter((h) => h.key.toLowerCase() !== 'authorization')
      if (filtered.length !== currentHeaders.length) {
        updateData.headers = stringifyJson(filtered)
      }
    }

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

  // Get inherited headers/params/auth from parent folders
  fastify.get<{ Params: { id: string } }>(
    '/api/folders/:id/inherited',
    async (request) => {
      try {
        const inherited = await getInheritedContextForFolder(request.params.id)
        return { data: inherited }
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to get inherited context' }
      }
    }
  )

  // Share folder with a user
  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/api/folders/:id/share',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = shareFolderSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
      }

      const userId = getCurrentUserId(request)
      const { email, permission } = parsed.data

      // Check if the current user owns the folder or has admin permission
      const folder = await prisma.folder.findUnique({
        where: { id: request.params.id },
        include: {
          shares: {
            where: { userId: userId! },
          },
        },
      })

      if (!folder) {
        return reply.status(404).send({ error: 'Folder not found' })
      }

      const isOwner = folder.userId === userId
      const hasAdminShare = folder.shares.some(s => s.permission === 'admin')

      if (!isOwner && !hasAdminShare) {
        return reply.status(403).send({ error: 'You do not have permission to share this folder' })
      }

      // Find the user to share with
      const targetUser = await prisma.user.findUnique({
        where: { email },
      })

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' })
      }

      if (targetUser.id === userId) {
        return reply.status(400).send({ error: 'Cannot share with yourself' })
      }

      // Create or update share
      const share = await prisma.folderShare.upsert({
        where: {
          folderId_userId: {
            folderId: request.params.id,
            userId: targetUser.id,
          },
        },
        update: { permission },
        create: {
          folderId: request.params.id,
          userId: targetUser.id,
          permission,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      })

      return { data: share }
    }
  )

  // Get folder shares
  fastify.get<{ Params: { id: string } }>(
    '/api/folders/:id/shares',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)

      // Check if the current user owns the folder or has access
      const folder = await prisma.folder.findUnique({
        where: { id: request.params.id },
        include: {
          shares: {
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      })

      if (!folder) {
        return reply.status(404).send({ error: 'Folder not found' })
      }

      const isOwner = folder.userId === userId
      const hasAccess = folder.shares.some(s => s.userId === userId)

      if (!isOwner && !hasAccess) {
        return reply.status(403).send({ error: 'You do not have access to this folder' })
      }

      return {
        data: {
          owner: folder.userId,
          shares: folder.shares,
        },
      }
    }
  )

  // Remove folder share
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/api/folders/:id/shares/:userId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const currentUserId = getCurrentUserId(request)

      // Check if the current user owns the folder or has admin permission
      const folder = await prisma.folder.findUnique({
        where: { id: request.params.id },
        include: {
          shares: {
            where: { userId: currentUserId! },
          },
        },
      })

      if (!folder) {
        return reply.status(404).send({ error: 'Folder not found' })
      }

      const isOwner = folder.userId === currentUserId
      const hasAdminShare = folder.shares.some(s => s.permission === 'admin')

      if (!isOwner && !hasAdminShare) {
        return reply.status(403).send({ error: 'You do not have permission to manage shares for this folder' })
      }

      await prisma.folderShare.delete({
        where: {
          folderId_userId: {
            folderId: request.params.id,
            userId: request.params.userId,
          },
        },
      })

      return { data: { success: true } }
    }
  )

  // Bulk cleanup: strip Authorization headers from all folders/requests that have auth configured
  fastify.post('/api/cleanup/auth-headers', async () => {
    let foldersFixed = 0
    let requestsFixed = 0

    // Fix folders — Authorization should never be in raw headers (except when authType is 'none')
    const folders = await prisma.folder.findMany()
    for (const folder of folders) {
      if (folder.authType === 'none') continue
      const headers = JSON.parse(folder.headers) as Array<{ key: string; value: string; enabled: boolean }>
      const filtered = headers.filter(h => h.key.toLowerCase() !== 'authorization')
      if (filtered.length !== headers.length) {
        await prisma.folder.update({
          where: { id: folder.id },
          data: { headers: JSON.stringify(filtered) },
        })
        foldersFixed++
      }
    }

    // Fix requests (except when authType is 'none')
    const requests = await prisma.request.findMany()
    for (const req of requests) {
      if (req.authType === 'none') continue
      const headers = JSON.parse(req.headers) as Array<{ key: string; value: string; enabled: boolean }>
      const filtered = headers.filter(h => h.key.toLowerCase() !== 'authorization')
      if (filtered.length !== headers.length) {
        await prisma.request.update({
          where: { id: req.id },
          data: { headers: JSON.stringify(filtered) },
        })
        requestsFixed++
      }
    }

    return { data: { success: true, foldersFixed, requestsFixed } }
  })
}
