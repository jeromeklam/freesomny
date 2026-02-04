import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { parseJsonObject } from '../lib/json.js'

export async function historyRoutes(fastify: FastifyInstance) {
  // Get history entries
  fastify.get<{ Querystring: { limit?: string; offset?: string; search?: string } }>(
    '/api/history',
    async (request) => {
      const limit = parseInt(request.query.limit || '50', 10)
      const offset = parseInt(request.query.offset || '0', 10)
      const search = request.query.search

      const where = search
        ? {
            OR: [
              { url: { contains: search } },
              { method: { contains: search } },
            ],
          }
        : undefined

      const [entries, total] = await Promise.all([
        prisma.historyEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.historyEntry.count({ where }),
      ])

      return {
        data: {
          entries: entries.map(e => ({
            ...e,
            requestHeaders: parseJsonObject<Record<string, string>>(e.requestHeaders),
            responseHeaders: parseJsonObject<Record<string, string>>(e.responseHeaders),
          })),
          total,
          limit,
          offset,
        },
      }
    }
  )

  // Get single history entry
  fastify.get<{ Params: { id: string } }>('/api/history/:id', async (request) => {
    const entry = await prisma.historyEntry.findUnique({
      where: { id: request.params.id },
    })

    if (!entry) {
      return { error: 'History entry not found' }
    }

    return {
      data: {
        ...entry,
        requestHeaders: parseJsonObject<Record<string, string>>(entry.requestHeaders),
        responseHeaders: parseJsonObject<Record<string, string>>(entry.responseHeaders),
      },
    }
  })

  // Delete single history entry
  fastify.delete<{ Params: { id: string } }>('/api/history/:id', async (request) => {
    await prisma.historyEntry.delete({
      where: { id: request.params.id },
    })

    return { data: { success: true } }
  })

  // Delete all history
  fastify.delete('/api/history', async () => {
    const deleted = await prisma.historyEntry.deleteMany()

    return { data: { success: true, count: deleted.count } }
  })
}
