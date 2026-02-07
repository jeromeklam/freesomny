import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyStatic from '@fastify/static'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

import { authRoutes } from './routes/auth.js'
import { folderRoutes } from './routes/folders.js'
import { requestRoutes } from './routes/requests.js'
import { environmentRoutes } from './routes/environments.js'
import { historyRoutes } from './routes/history.js'
import { sendRoutes } from './routes/send.js'
import { settingsRoutes } from './routes/settings.js'
import { importRoutes } from './routes/import.js'
import { groupRoutes } from './routes/groups.js'
import { adminRoutes } from './routes/admin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  // CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  })

  // JWT
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production-very-secret-key',
    sign: {
      expiresIn: '7d', // Token expires in 7 days
    },
  })

  // API routes
  await fastify.register(authRoutes)
  await fastify.register(folderRoutes)
  await fastify.register(requestRoutes)
  await fastify.register(environmentRoutes)
  await fastify.register(historyRoutes)
  await fastify.register(sendRoutes)
  await fastify.register(settingsRoutes)
  await fastify.register(importRoutes)
  await fastify.register(groupRoutes)
  await fastify.register(adminRoutes)

  // Serve static files in production
  const webDistPath = join(__dirname, '../../web/dist')
  if (existsSync(webDistPath)) {
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    })

    // SPA fallback
    fastify.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/api/')) {
        return reply.sendFile('index.html')
      }
      return reply.status(404).send({ error: 'Not found' })
    })
  }

  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // Start server
  const port = parseInt(process.env.PORT || '3000', 10)
  const host = process.env.HOST || '0.0.0.0'

  try {
    await fastify.listen({ port, host })
    console.log(`Server running at http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

main()
