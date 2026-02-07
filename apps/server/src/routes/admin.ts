import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { requireAdmin, getCurrentUser, hashPassword } from '../lib/auth.js'
import { sendPasswordResetEmail, isSmtpConfigured } from '../services/email.js'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
})

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin', 'owner']).default('member'),
})

async function logAudit(action: string, userId: string | null, targetId: string | null, details: Record<string, unknown> = {}) {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      targetId,
      details: JSON.stringify(details),
    },
  })
}

export async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require admin role
  fastify.addHook('preHandler', requireAdmin)

  // ─── Dashboard Stats ───

  fastify.get('/api/admin/stats', async () => {
    const [userCount, groupCount, folderCount, requestCount, environmentCount] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.folder.count({ where: { parentId: null } }),
      prisma.request.count(),
      prisma.environment.count(),
    ])

    return {
      data: {
        users: userCount,
        groups: groupCount,
        collections: folderCount,
        requests: requestCount,
        environments: environmentCount,
      },
    }
  })

  fastify.get('/api/admin/smtp-status', async () => {
    return { data: { configured: isSmtpConfigured() } }
  })

  // ─── Users ───

  fastify.get('/api/admin/users', async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { folders: true, groupMemberships: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return { data: users }
  })

  fastify.get<{ Params: { id: string } }>('/api/admin/users/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { folders: true, groupMemberships: true, environments: true },
        },
        groupMemberships: {
          include: {
            group: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return { data: user }
  })

  fastify.put<{ Params: { id: string }; Body: unknown }>('/api/admin/users/:id', async (request, reply) => {
    const parsed = updateUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const currentUser = getCurrentUser(request)
    const targetUser = await prisma.user.findUnique({ where: { id: request.params.id } })
    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    // Log changes
    if (parsed.data.role && parsed.data.role !== targetUser.role) {
      await logAudit('user.role_changed', currentUser?.id || null, user.id, {
        from: targetUser.role,
        to: parsed.data.role,
      })
    }
    if (parsed.data.isActive !== undefined && parsed.data.isActive !== targetUser.isActive) {
      await logAudit(
        parsed.data.isActive ? 'user.activated' : 'user.deactivated',
        currentUser?.id || null,
        user.id,
        { email: user.email }
      )
    }

    return { data: user }
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/users/:id', async (request, reply) => {
    const currentUser = getCurrentUser(request)

    if (currentUser?.id === request.params.id) {
      return reply.status(400).send({ error: 'Cannot delete your own account' })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: request.params.id } })
    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' })
    }

    await prisma.user.delete({ where: { id: request.params.id } })

    await logAudit('user.deleted', currentUser?.id || null, request.params.id, {
      email: targetUser.email,
    })

    return { data: { success: true } }
  })

  // Admin-triggered password reset
  fastify.post<{ Params: { id: string } }>('/api/admin/users/:id/reset-password', async (request, reply) => {
    const currentUser = getCurrentUser(request)
    const targetUser = await prisma.user.findUnique({ where: { id: request.params.id } })
    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: request.params.id },
      data: { resetToken: token, resetTokenExpiresAt: expiresAt },
    })

    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    const result = await sendPasswordResetEmail(targetUser.email, resetUrl)

    await logAudit('user.password_reset', currentUser?.id || null, request.params.id, {
      email: targetUser.email,
      consoleOnly: result.consoleOnly,
    })

    return { data: { success: true, consoleOnly: result.consoleOnly } }
  })

  // ─── Groups ───

  fastify.get('/api/admin/groups', async () => {
    const groups = await prisma.group.findMany({
      include: {
        _count: {
          select: { members: true, folders: true, environments: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { data: groups }
  })

  fastify.get<{ Params: { id: string } }>('/api/admin/groups/:id', async (request, reply) => {
    const group = await prisma.group.findUnique({
      where: { id: request.params.id },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { folders: true, environments: true },
        },
      },
    })

    if (!group) {
      return reply.status(404).send({ error: 'Group not found' })
    }

    return { data: group }
  })

  fastify.post<{ Body: unknown }>('/api/admin/groups', async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const currentUser = getCurrentUser(request)

    const group = await prisma.group.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        members: {
          create: {
            userId: currentUser!.id,
            role: 'owner',
          },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
        _count: {
          select: { folders: true, environments: true },
        },
      },
    })

    await logAudit('group.created', currentUser?.id || null, group.id, { name: group.name })

    return { data: group }
  })

  fastify.put<{ Params: { id: string }; Body: unknown }>('/api/admin/groups/:id', async (request, reply) => {
    const parsed = updateGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const group = await prisma.group.findUnique({ where: { id: request.params.id } })
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' })
    }

    const updated = await prisma.group.update({
      where: { id: request.params.id },
      data: parsed.data,
    })

    const currentUser = getCurrentUser(request)
    await logAudit('group.updated', currentUser?.id || null, updated.id, { name: updated.name })

    return { data: updated }
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/groups/:id', async (request, reply) => {
    const group = await prisma.group.findUnique({ where: { id: request.params.id } })
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' })
    }

    await prisma.group.delete({ where: { id: request.params.id } })

    const currentUser = getCurrentUser(request)
    await logAudit('group.deleted', currentUser?.id || null, request.params.id, { name: group.name })

    return { data: { success: true } }
  })

  // Add member to group (admin)
  fastify.post<{ Params: { id: string }; Body: unknown }>('/api/admin/groups/:id/members', async (request, reply) => {
    const parsed = addMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const targetUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: request.params.id,
          userId: targetUser.id,
        },
      },
    })
    if (existing) {
      return reply.status(400).send({ error: 'User is already a member of this group' })
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId: request.params.id,
        userId: targetUser.id,
        role: parsed.data.role,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    })

    const currentUser = getCurrentUser(request)
    await logAudit('group.member_added', currentUser?.id || null, request.params.id, {
      memberEmail: targetUser.email,
      role: parsed.data.role,
    })

    return { data: member }
  })

  // Remove member from group (admin)
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/api/admin/groups/:id/members/:memberId',
    async (request, reply) => {
      const member = await prisma.groupMember.findUnique({
        where: { id: request.params.memberId },
        include: { user: { select: { email: true } } },
      })

      if (!member) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      await prisma.groupMember.delete({ where: { id: request.params.memberId } })

      const currentUser = getCurrentUser(request)
      await logAudit('group.member_removed', currentUser?.id || null, request.params.id, {
        memberEmail: member.user.email,
      })

      return { data: { success: true } }
    }
  )

  // ─── Audit Log ───

  fastify.get<{ Querystring: { limit?: string; offset?: string } }>('/api/admin/audit', async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '50', 10), 100)
    const offset = parseInt(request.query.offset || '0', 10)

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ])

    return { data: { entries, total } }
  })
}
