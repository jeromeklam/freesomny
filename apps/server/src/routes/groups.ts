import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, getCurrentUserId } from '../lib/auth.js'

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
  role: z.enum(['member', 'admin']).default('member'),
})

const updateMemberSchema = z.object({
  role: z.enum(['member', 'admin']),
})

export async function groupRoutes(fastify: FastifyInstance) {
  // Get all groups the current user is a member of
  fastify.get('/api/groups', { preHandler: [requireAuth] }, async (request) => {
    const userId = getCurrentUserId(request)

    const memberships = await prisma.groupMember.findMany({
      where: { userId: userId! },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, email: true, name: true },
                },
              },
            },
            _count: {
              select: { folders: true, environments: true },
            },
          },
        },
      },
      orderBy: { group: { name: 'asc' } },
    })

    const groups = memberships.map((m) => ({
      ...m.group,
      myRole: m.role,
      memberCount: m.group.members.length,
      folderCount: m.group._count.folders,
      environmentCount: m.group._count.environments,
    }))

    return { data: groups }
  })

  // Get single group
  fastify.get<{ Params: { id: string } }>(
    '/api/groups/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)

      const group = await prisma.group.findUnique({
        where: { id: request.params.id },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          folders: {
            where: { parentId: null },
            orderBy: { sortOrder: 'asc' },
          },
          environments: {
            orderBy: { name: 'asc' },
          },
        },
      })

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' })
      }

      // Check if user is a member
      const membership = group.members.find((m) => m.userId === userId)
      if (!membership) {
        return reply.status(403).send({ error: 'You are not a member of this group' })
      }

      return {
        data: {
          ...group,
          myRole: membership.role,
        },
      }
    }
  )

  // Create group
  fastify.post<{ Body: unknown }>(
    '/api/groups',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = createGroupSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
      }

      const userId = getCurrentUserId(request)

      // Create group and add creator as owner
      const group = await prisma.group.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          members: {
            create: {
              userId: userId!,
              role: 'owner',
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      })

      return { data: { ...group, myRole: 'owner' } }
    }
  )

  // Update group
  fastify.put<{ Params: { id: string }; Body: unknown }>(
    '/api/groups/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = updateGroupSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
      }

      const userId = getCurrentUserId(request)

      // Check if user is admin or owner
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return reply.status(403).send({ error: 'You do not have permission to update this group' })
      }

      const group = await prisma.group.update({
        where: { id: request.params.id },
        data: parsed.data,
      })

      return { data: group }
    }
  )

  // Delete group
  fastify.delete<{ Params: { id: string } }>(
    '/api/groups/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)

      // Check if user is owner
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      if (!membership || membership.role !== 'owner') {
        return reply.status(403).send({ error: 'Only the owner can delete the group' })
      }

      await prisma.group.delete({
        where: { id: request.params.id },
      })

      return { data: { success: true } }
    }
  )

  // Add member to group
  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/api/groups/:id/members',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = addMemberSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
      }

      const userId = getCurrentUserId(request)
      const { email, role } = parsed.data

      // Check if user is admin or owner
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return reply.status(403).send({ error: 'You do not have permission to add members' })
      }

      // Find user by email
      const targetUser = await prisma.user.findUnique({
        where: { email },
      })

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' })
      }

      // Check if already a member
      const existingMembership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: targetUser.id,
          },
        },
      })

      if (existingMembership) {
        return reply.status(400).send({ error: 'User is already a member of this group' })
      }

      const newMember = await prisma.groupMember.create({
        data: {
          groupId: request.params.id,
          userId: targetUser.id,
          role,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      })

      return { data: newMember }
    }
  )

  // Update member role
  fastify.put<{ Params: { id: string; memberId: string }; Body: unknown }>(
    '/api/groups/:id/members/:memberId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = updateMemberSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
      }

      const userId = getCurrentUserId(request)

      // Check if user is owner (only owner can change roles)
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      if (!membership || membership.role !== 'owner') {
        return reply.status(403).send({ error: 'Only the owner can change member roles' })
      }

      // Can't change owner's role
      const targetMember = await prisma.groupMember.findUnique({
        where: { id: request.params.memberId },
      })

      if (!targetMember) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      if (targetMember.role === 'owner') {
        return reply.status(400).send({ error: 'Cannot change the owner role' })
      }

      const updatedMember = await prisma.groupMember.update({
        where: { id: request.params.memberId },
        data: { role: parsed.data.role },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      })

      return { data: updatedMember }
    }
  )

  // Remove member from group
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/api/groups/:id/members/:memberId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)

      // Get current user's membership
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      // Get target member
      const targetMember = await prisma.groupMember.findUnique({
        where: { id: request.params.memberId },
      })

      if (!targetMember) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      // Owner can't be removed
      if (targetMember.role === 'owner') {
        return reply.status(400).send({ error: 'Cannot remove the owner from the group' })
      }

      // Users can remove themselves, admins/owners can remove others
      const isSelf = targetMember.userId === userId
      const canRemoveOthers = membership && (membership.role === 'admin' || membership.role === 'owner')

      if (!isSelf && !canRemoveOthers) {
        return reply.status(403).send({ error: 'You do not have permission to remove this member' })
      }

      await prisma.groupMember.delete({
        where: { id: request.params.memberId },
      })

      return { data: { success: true } }
    }
  )

  // Transfer ownership
  fastify.post<{ Params: { id: string; memberId: string } }>(
    '/api/groups/:id/transfer-ownership/:memberId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)

      // Check if user is owner
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      if (!membership || membership.role !== 'owner') {
        return reply.status(403).send({ error: 'Only the owner can transfer ownership' })
      }

      const targetMember = await prisma.groupMember.findUnique({
        where: { id: request.params.memberId },
      })

      if (!targetMember) {
        return reply.status(404).send({ error: 'Member not found' })
      }

      if (targetMember.groupId !== request.params.id) {
        return reply.status(400).send({ error: 'Member does not belong to this group' })
      }

      // Transfer ownership in a transaction
      await prisma.$transaction([
        // Make new member owner
        prisma.groupMember.update({
          where: { id: request.params.memberId },
          data: { role: 'owner' },
        }),
        // Make current owner admin
        prisma.groupMember.update({
          where: { id: membership.id },
          data: { role: 'admin' },
        }),
      ])

      return { data: { success: true } }
    }
  )

  // Assign folder to group
  fastify.post<{ Params: { id: string }; Body: { folderId: string } }>(
    '/api/groups/:id/folders',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)
      const { folderId } = request.body

      // Check if user is admin or owner of group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return reply.status(403).send({ error: 'You do not have permission to assign folders to this group' })
      }

      // Check if user owns the folder
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      })

      if (!folder) {
        return reply.status(404).send({ error: 'Folder not found' })
      }

      if (folder.userId !== userId) {
        return reply.status(403).send({ error: 'You can only assign folders you own' })
      }

      // Assign folder to group (remove user ownership)
      const updatedFolder = await prisma.folder.update({
        where: { id: folderId },
        data: {
          groupId: request.params.id,
          userId: null,
        },
      })

      return { data: updatedFolder }
    }
  )

  // Assign environment to group
  fastify.post<{ Params: { id: string }; Body: { environmentId: string } }>(
    '/api/groups/:id/environments',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = getCurrentUserId(request)
      const { environmentId } = request.body

      // Check if user is admin or owner of group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: request.params.id,
            userId: userId!,
          },
        },
      })

      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return reply.status(403).send({ error: 'You do not have permission to assign environments to this group' })
      }

      // Check if user owns the environment
      const environment = await prisma.environment.findUnique({
        where: { id: environmentId },
      })

      if (!environment) {
        return reply.status(404).send({ error: 'Environment not found' })
      }

      if (environment.userId !== userId) {
        return reply.status(403).send({ error: 'You can only assign environments you own' })
      }

      // Assign environment to group (remove user ownership)
      const updatedEnv = await prisma.environment.update({
        where: { id: environmentId },
        data: {
          groupId: request.params.id,
          userId: null,
        },
      })

      return { data: updatedEnv }
    }
  )
}
