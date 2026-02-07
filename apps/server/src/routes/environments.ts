import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createEnvironmentSchema, updateEnvironmentSchema, createVariableSchema, updateVariableSchema, createOverrideSchema, updateOverrideSchema } from '@api-client/shared'
import { getVariablesView } from '../services/environment.js'
import { optionalAuth, requireAuth, getCurrentUserId } from '../lib/auth.js'

const shareEnvironmentSchema = z.object({
  email: z.string().email(),
  permission: z.enum(['read', 'write', 'admin']).default('read'),
})

export async function environmentRoutes(fastify: FastifyInstance) {
  // Get all environments
  fastify.get('/api/environments', { preHandler: [optionalAuth] }, async (request) => {
    const userId = getCurrentUserId(request)

    // Build where clause: if authenticated, show owned + shared + group environments
    let whereClause = {}
    if (userId) {
      const sharedEnvs = await prisma.environmentShare.findMany({
        where: { userId },
        select: { environmentId: true },
      })
      const sharedEnvIds = sharedEnvs.map(se => se.environmentId)

      // Get groups the user is a member of
      const groupMemberships = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      })
      const groupIds = groupMemberships.map(gm => gm.groupId)

      whereClause = {
        OR: [
          { userId },
          { id: { in: sharedEnvIds } },
          { groupId: { in: groupIds } },
        ],
      }
    }

    const environments = await prisma.environment.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        variables: true,
        group: {
          select: { id: true, name: true },
        },
      },
    })

    return { data: environments }
  })

  // Get single environment
  fastify.get<{ Params: { id: string } }>('/api/environments/:id', async (request) => {
    const env = await prisma.environment.findUnique({
      where: { id: request.params.id },
      include: { variables: true },
    })

    if (!env) {
      return { error: 'Environment not found' }
    }

    return { data: env }
  })

  // Create environment
  fastify.post<{ Body: unknown }>('/api/environments', { preHandler: [optionalAuth] }, async (request) => {
    const parsed = createEnvironmentSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    const userId = getCurrentUserId(request)

    // If new env is active, deactivate all others (for this user)
    if (parsed.data.isActive) {
      await prisma.environment.updateMany({
        where: userId ? { userId } : {},
        data: { isActive: false },
      })
    }

    const env = await prisma.environment.create({
      data: {
        ...parsed.data,
        userId: userId,
      },
    })

    return { data: env }
  })

  // Update environment
  fastify.put<{ Params: { id: string }; Body: unknown }>('/api/environments/:id', async (request) => {
    const parsed = updateEnvironmentSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    // If setting active, deactivate all others
    if (parsed.data.isActive) {
      await prisma.environment.updateMany({
        where: { id: { not: request.params.id } },
        data: { isActive: false },
      })
    }

    const env = await prisma.environment.update({
      where: { id: request.params.id },
      data: parsed.data,
    })

    return { data: env }
  })

  // Delete environment
  fastify.delete<{ Params: { id: string } }>('/api/environments/:id', async (request) => {
    await prisma.environment.delete({
      where: { id: request.params.id },
    })

    return { data: { success: true } }
  })

  // Activate environment
  fastify.put<{ Params: { id: string } }>('/api/environments/:id/activate', async (request) => {
    // Deactivate all
    await prisma.environment.updateMany({
      data: { isActive: false },
    })

    // Activate this one
    const env = await prisma.environment.update({
      where: { id: request.params.id },
      data: { isActive: true },
    })

    return { data: env }
  })

  // Get merged variables view
  fastify.get<{ Params: { id: string } }>('/api/environments/:id/variables', async (request) => {
    const view = await getVariablesView(request.params.id)
    return { data: view }
  })

  // Set team variable
  fastify.put<{ Params: { id: string; key: string }; Body: unknown }>(
    '/api/environments/:id/variables/:key',
    async (request) => {
      const parsed = createVariableSchema.safeParse({ ...(request.body as object), key: request.params.key })
      if (!parsed.success) {
        return { error: 'Validation failed', details: parsed.error.errors }
      }

      // Get max sortOrder for new variables
      const maxOrder = await prisma.environmentVariable.aggregate({
        where: { environmentId: request.params.id },
        _max: { sortOrder: true },
      })
      const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1

      const variable = await prisma.environmentVariable.upsert({
        where: {
          environmentId_key_scope: {
            environmentId: request.params.id,
            key: request.params.key,
            scope: parsed.data.scope,
          },
        },
        create: {
          environmentId: request.params.id,
          key: parsed.data.key,
          value: parsed.data.value,
          description: parsed.data.description,
          type: parsed.data.type,
          scope: parsed.data.scope,
          isSecret: parsed.data.isSecret,
          category: parsed.data.category,
          sortOrder: nextOrder,
        },
        update: {
          value: parsed.data.value,
          description: parsed.data.description,
          type: parsed.data.type,
          isSecret: parsed.data.isSecret,
          category: parsed.data.category,
        },
      })

      return { data: variable }
    }
  )

  // Delete team variable
  fastify.delete<{ Params: { id: string; key: string } }>(
    '/api/environments/:id/variables/:key',
    async (request) => {
      await prisma.environmentVariable.deleteMany({
        where: {
          environmentId: request.params.id,
          key: request.params.key,
        },
      })

      return { data: { success: true } }
    }
  )

  // Set local override
  fastify.put<{ Params: { id: string; key: string }; Body: unknown }>(
    '/api/environments/:id/overrides/:key',
    async (request) => {
      const parsed = createOverrideSchema.safeParse({ ...(request.body as object), key: request.params.key })
      if (!parsed.success) {
        return { error: 'Validation failed', details: parsed.error.errors }
      }

      const override = await prisma.localOverride.upsert({
        where: {
          environmentId_key_userId: {
            environmentId: request.params.id,
            key: request.params.key,
            userId: 'local',
          },
        },
        create: {
          environmentId: request.params.id,
          key: parsed.data.key,
          value: parsed.data.value,
          description: parsed.data.description,
          userId: 'local',
        },
        update: {
          value: parsed.data.value,
          description: parsed.data.description,
        },
      })

      return { data: override }
    }
  )

  // Delete single local override
  fastify.delete<{ Params: { id: string; key: string } }>(
    '/api/environments/:id/overrides/:key',
    async (request) => {
      await prisma.localOverride.deleteMany({
        where: {
          environmentId: request.params.id,
          key: request.params.key,
          userId: 'local',
        },
      })

      return { data: { success: true } }
    }
  )

  // Delete ALL local overrides (factory reset)
  fastify.delete<{ Params: { id: string } }>(
    '/api/environments/:id/overrides',
    async (request) => {
      const deleted = await prisma.localOverride.deleteMany({
        where: {
          environmentId: request.params.id,
          userId: 'local',
        },
      })

      return { data: { success: true, count: deleted.count } }
    }
  )

  // Reorder variables
  fastify.put<{ Params: { id: string }; Body: unknown }>(
    '/api/environments/:id/variables/reorder',
    async (request) => {
      const body = request.body as { keys: string[] }
      if (!Array.isArray(body.keys)) {
        return { error: 'keys must be an array of variable keys' }
      }

      // Update sortOrder for each key
      const updates = body.keys.map((key, index) =>
        prisma.environmentVariable.updateMany({
          where: { environmentId: request.params.id, key },
          data: { sortOrder: index },
        })
      )

      await prisma.$transaction(updates)

      return { data: { success: true } }
    }
  )

  // Share environment with a user
  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/api/environments/:id/share',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = shareEnvironmentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
      }

      const userId = getCurrentUserId(request)
      const { email, permission } = parsed.data

      // Check if the current user owns the environment or has admin permission
      const environment = await prisma.environment.findUnique({
        where: { id: request.params.id },
        include: {
          shares: {
            where: { userId: userId! },
          },
        },
      })

      if (!environment) {
        return reply.status(404).send({ error: 'Environment not found' })
      }

      const isOwner = environment.userId === userId
      const hasAdminShare = environment.shares.some(s => s.permission === 'admin')

      if (!isOwner && !hasAdminShare) {
        return reply.status(403).send({ error: 'You do not have permission to share this environment' })
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
      const share = await prisma.environmentShare.upsert({
        where: {
          environmentId_userId: {
            environmentId: request.params.id,
            userId: targetUser.id,
          },
        },
        update: { permission },
        create: {
          environmentId: request.params.id,
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

  // Get environment shares
  fastify.get<{ Params: { id: string } }>(
    '/api/environments/:id/shares',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)

      const environment = await prisma.environment.findUnique({
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

      if (!environment) {
        return reply.status(404).send({ error: 'Environment not found' })
      }

      const isOwner = environment.userId === userId
      const hasAccess = environment.shares.some(s => s.userId === userId)

      if (!isOwner && !hasAccess) {
        return reply.status(403).send({ error: 'You do not have access to this environment' })
      }

      return {
        data: {
          owner: environment.userId,
          shares: environment.shares,
        },
      }
    }
  )

  // Remove environment share
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/api/environments/:id/shares/:userId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const currentUserId = getCurrentUserId(request)

      const environment = await prisma.environment.findUnique({
        where: { id: request.params.id },
        include: {
          shares: {
            where: { userId: currentUserId! },
          },
        },
      })

      if (!environment) {
        return reply.status(404).send({ error: 'Environment not found' })
      }

      const isOwner = environment.userId === currentUserId
      const hasAdminShare = environment.shares.some(s => s.permission === 'admin')

      if (!isOwner && !hasAdminShare) {
        return reply.status(403).send({ error: 'You do not have permission to manage shares for this environment' })
      }

      await prisma.environmentShare.delete({
        where: {
          environmentId_userId: {
            environmentId: request.params.id,
            userId: request.params.userId,
          },
        },
      })

      return { data: { success: true } }
    }
  )
}
