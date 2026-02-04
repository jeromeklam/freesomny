import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { createEnvironmentSchema, updateEnvironmentSchema, createVariableSchema, updateVariableSchema, createOverrideSchema, updateOverrideSchema } from '@api-client/shared'
import { getVariablesView } from '../services/environment.js'

export async function environmentRoutes(fastify: FastifyInstance) {
  // Get all environments
  fastify.get('/api/environments', async () => {
    const environments = await prisma.environment.findMany({
      orderBy: { name: 'asc' },
      include: { variables: true },
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
  fastify.post<{ Body: unknown }>('/api/environments', async (request) => {
    const parsed = createEnvironmentSchema.safeParse(request.body)
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.errors }
    }

    // If new env is active, deactivate all others
    if (parsed.data.isActive) {
      await prisma.environment.updateMany({
        data: { isActive: false },
      })
    }

    const env = await prisma.environment.create({
      data: parsed.data,
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
        },
        update: {
          value: parsed.data.value,
          description: parsed.data.description,
          type: parsed.data.type,
          isSecret: parsed.data.isSecret,
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
}
