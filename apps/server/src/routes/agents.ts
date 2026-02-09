import type { FastifyInstance } from 'fastify'
import { requireAuth, getCurrentUser } from '../lib/auth.js'
import { agentManager } from '../services/agent-manager.js'

export async function agentRoutes(fastify: FastifyInstance) {
  // WebSocket endpoint for agent connections
  fastify.get('/api/ws/agent', { websocket: true }, (socket, request) => {
    const query = request.query as Record<string, string>
    const token = query.token
    const name = query.name || 'Unknown Agent'

    if (!token) {
      socket.close(4001, 'Missing token')
      return
    }

    try {
      const decoded = fastify.jwt.verify<{ id: string; email: string; name: string; role: string }>(token)
      const agentId = agentManager.register(socket, decoded.id, decoded.name, name)

      // Send welcome message with agent ID
      socket.send(JSON.stringify({ type: 'registered', agentId }))

      fastify.log.info(`Agent "${name}" connected for user ${decoded.email} (agentId: ${agentId})`)
    } catch {
      socket.close(4002, 'Invalid token')
    }
  })

  // List connected agents for current user
  fastify.get('/api/agents', { preHandler: [requireAuth] }, async (request) => {
    const user = getCurrentUser(request)
    if (!user) return { error: 'Unauthorized' }

    const agents = agentManager.getAgentsForUser(user.id)
    return { data: agents }
  })
}
