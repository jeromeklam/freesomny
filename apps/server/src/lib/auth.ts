import bcrypt from 'bcryptjs'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export interface JwtPayload {
  id: string
  email: string
  name: string
  role: string
}

// Middleware to check if user is authenticated
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

// Middleware to check if user is admin
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const user = request.user as JwtPayload
    if (user.role !== 'admin') {
      reply.status(403).send({ error: 'Forbidden' })
    }
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

// Optional auth - don't fail if not authenticated, but set user if valid token
export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    // Ignore - user not authenticated, that's ok
  }
}

// Helper to get current user from request
export function getCurrentUser(request: FastifyRequest): JwtPayload | null {
  return (request.user as JwtPayload) || null
}

// Helper to get current user ID from request
export function getCurrentUserId(request: FastifyRequest): string | null {
  const user = getCurrentUser(request)
  return user?.id || null
}
