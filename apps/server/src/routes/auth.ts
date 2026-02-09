import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { hashPassword, verifyPassword, requireAuth, getCurrentUser, type JwtPayload } from '../lib/auth.js'
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  currentPassword: z.string().optional(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
})

export async function authRoutes(fastify: FastifyInstance) {
  // Register new user
  fastify.post<{ Body: unknown }>('/api/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { email, password, name } = parsed.data

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return reply.status(400).send({ error: 'Email already registered' })
    }

    // Check if this is the first user (setup mode)
    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    // Hash password and create user
    const hashedPassword = await hashPassword(password)
    const verifyToken = randomBytes(32).toString('hex')
    const verifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Try creating with verification fields; fall back to basic create if migration hasn't run
    let user
    try {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: isFirstUser ? 'admin' : 'user',
          isActive: isFirstUser,
          isVerified: isFirstUser,
          verifyToken: isFirstUser ? null : verifyToken,
          verifyTokenExpiresAt: isFirstUser ? null : verifyTokenExpiresAt,
        },
      })
    } catch {
      // Verification fields not available — create without them
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: isFirstUser ? 'admin' : 'user',
          isActive: true,
        },
      })
    }

    // First user: auto-login
    if (isFirstUser) {
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      } as JwtPayload)

      return {
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      }
    }

    // Send verification email (only if verification fields exist)
    if ('isVerified' in user && !user.isVerified) {
      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      const verifyUrl = `${appUrl}/verify?token=${verifyToken}`
      await sendVerificationEmail(email, verifyUrl)

      return {
        data: {
          message: 'Registration successful. Check your email to verify your account.',
          requiresVerification: true,
        },
      }
    }

    // Fallback: auto-login if no verification
    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    } as JwtPayload)

    return {
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    }
  })

  // Login
  fastify.post<{ Body: unknown }>('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { email, password } = parsed.data

    // Find user
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // Check email verification (isVerified may not exist if migration hasn't run)
    if ('isVerified' in user && !user.isVerified) {
      return reply.status(403).send({ error: 'Please verify your email first. Check your inbox for the verification link.' })
    }

    // Check admin approval
    if (!user.isActive) {
      return reply.status(403).send({ error: 'Your account is pending admin approval.' })
    }

    // Generate JWT
    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    } as JwtPayload)

    return {
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    }
  })

  // Get current user
  fastify.get('/api/auth/me', { preHandler: [requireAuth] }, async (request) => {
    const currentUser = getCurrentUser(request)
    if (!currentUser) {
      return { error: 'Not authenticated' }
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return { error: 'User not found' }
    }

    return { data: user }
  })

  // Update profile
  fastify.put<{ Body: unknown }>('/api/auth/profile', { preHandler: [requireAuth] }, async (request, reply) => {
    const currentUser = getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Not authenticated' })
    }

    const parsed = updateProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { name, password, currentPassword } = parsed.data
    const updateData: { name?: string; password?: string } = {}

    if (name) {
      updateData.name = name
    }

    // If changing password, verify current password first
    if (password) {
      if (!currentPassword) {
        return reply.status(400).send({ error: 'Current password required to change password' })
      }

      const user = await prisma.user.findUnique({ where: { id: currentUser.id } })
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      const isValid = await verifyPassword(currentPassword, user.password)
      if (!isValid) {
        return reply.status(400).send({ error: 'Current password is incorrect' })
      }

      updateData.password = await hashPassword(password)
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    return { data: user }
  })

  // Forgot password — request reset link
  fastify.post<{ Body: unknown }>('/api/auth/forgot-password', async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { email } = parsed.data

    // Always return success to not leak user existence
    const user = await prisma.user.findUnique({ where: { email } })
    if (user && user.isActive) {
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpiresAt: expiresAt },
      })

      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      const resetUrl = `${appUrl}/reset-password?token=${token}`

      await sendPasswordResetEmail(email, resetUrl)
    }

    return { data: { success: true } }
  })

  // Reset password — set new password with token
  fastify.post<{ Body: unknown }>('/api/auth/reset-password', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { token, password } = parsed.data

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: { gt: new Date() },
      },
    })

    if (!user) {
      return reply.status(400).send({ error: 'Invalid or expired reset link' })
    }

    const hashedPassword = await hashPassword(password)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    })

    return { data: { success: true } }
  })

  // Verify email
  fastify.get<{ Querystring: { token?: string } }>('/api/auth/verify', async (request, reply) => {
    const token = request.query.token
    if (!token) {
      return reply.status(400).send({ error: 'Missing verification token' })
    }

    try {
      const user = await prisma.user.findFirst({
        where: {
          verifyToken: token,
          verifyTokenExpiresAt: { gt: new Date() },
        },
      })

      if (!user) {
        return reply.status(400).send({ error: 'Invalid or expired verification link' })
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          verifyToken: null,
          verifyTokenExpiresAt: null,
        },
      })

      return { data: { success: true, message: 'Email verified successfully. An administrator will review your account.' } }
    } catch {
      return reply.status(400).send({ error: 'Email verification is not available. Please contact the administrator.' })
    }
  })

  // Check if auth is required (used by frontend to determine if login is needed)
  fastify.get('/api/auth/status', async () => {
    // Check if any users exist
    const userCount = await prisma.user.count()

    // Count pending users (verified but not yet approved)
    // Wrapped in try/catch for backwards compatibility if migration hasn't run yet
    let pendingUsers = 0
    try {
      pendingUsers = await prisma.user.count({
        where: { isVerified: true, isActive: false },
      })
    } catch {
      // isVerified field not yet available — migration pending
    }

    // AUTH_REQUIRED env var forces authentication even with no users
    // When true: always require auth (team/production mode)
    // When false/unset: only require auth if users exist (single-user/dev mode)
    const authEnvRequired = process.env.AUTH_REQUIRED === 'true'

    return {
      data: {
        authRequired: authEnvRequired || userCount > 0,
        setupRequired: userCount === 0,
        pendingUsers,
      },
    }
  })
}
