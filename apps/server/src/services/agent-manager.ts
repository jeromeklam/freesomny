import type { WebSocket } from 'ws'
import { randomUUID } from 'crypto'

export interface ConnectedAgent {
  id: string
  ws: WebSocket
  userId: string
  userName: string
  agentName: string
  connectedAt: Date
  lastHeartbeat: Date
}

// Message types for server <-> agent protocol
export interface AgentRequestMessage {
  type: 'execute-request'
  requestId: string
  payload: {
    method: string
    url: string
    headers: Record<string, string>
    body: string | null
    timeout: number
    followRedirects: boolean
    verifySsl: boolean
  }
}

export interface AgentResponseMessage {
  type: 'request-response'
  requestId: string
  payload: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    bodyEncoding?: 'base64' | 'utf8'
    time: number
    size: number
  }
}

export interface AgentErrorMessage {
  type: 'error'
  requestId: string
  error: string
}

export interface AgentHeartbeatMessage {
  type: 'heartbeat'
}

type AgentMessage = AgentResponseMessage | AgentHeartbeatMessage | AgentErrorMessage

interface PendingRequest {
  resolve: (response: AgentResponseMessage['payload']) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

class AgentManager {
  private agents = new Map<string, ConnectedAgent>()
  private pendingRequests = new Map<string, PendingRequest>()

  register(ws: WebSocket, userId: string, userName: string, agentName: string): string {
    const id = randomUUID()
    const agent: ConnectedAgent = {
      id,
      ws,
      userId,
      userName,
      agentName,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    }
    this.agents.set(id, agent)

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as AgentMessage
        this.handleMessage(id, msg)
      } catch {
        // Invalid message, ignore
      }
    })

    ws.on('close', () => {
      this.unregister(id)
    })

    ws.on('error', () => {
      this.unregister(id)
    })

    return id
  }

  unregister(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      // Reject all pending requests from this agent
      for (const [reqId, pending] of this.pendingRequests) {
        pending.reject(new Error('Agent disconnected'))
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(reqId)
      }
      this.agents.delete(agentId)
    }
  }

  getAgentsForUser(userId: string): Array<{
    id: string
    name: string
    connectedAt: string
    lastHeartbeat: string
  }> {
    const result: Array<{ id: string; name: string; connectedAt: string; lastHeartbeat: string }> = []
    for (const agent of this.agents.values()) {
      if (agent.userId === userId) {
        result.push({
          id: agent.id,
          name: agent.agentName,
          connectedAt: agent.connectedAt.toISOString(),
          lastHeartbeat: agent.lastHeartbeat.toISOString(),
        })
      }
    }
    return result
  }

  async sendRequest(
    agentId: string,
    prepared: {
      method: string
      url: string
      headers: Record<string, string>
      body: string | null
      timeout: number
      followRedirects: boolean
      verifySsl: boolean
    }
  ): Promise<AgentResponseMessage['payload']> {
    const agent = this.agents.get(agentId)
    if (!agent) throw new Error('Agent not found or disconnected')

    const requestId = randomUUID()

    return new Promise<AgentResponseMessage['payload']>((resolve, reject) => {
      const timeoutMs = (prepared.timeout || 30000) + 5000 // Agent timeout + 5s buffer

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Agent request timed out'))
      }, timeoutMs)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      const msg: AgentRequestMessage = {
        type: 'execute-request',
        requestId,
        payload: prepared,
      }

      agent.ws.send(JSON.stringify(msg))
    })
  }

  private handleMessage(agentId: string, msg: AgentMessage): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    switch (msg.type) {
      case 'heartbeat':
        agent.lastHeartbeat = new Date()
        break
      case 'request-response': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.payload)
        }
        break
      }
      case 'error': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(msg.requestId)
          pending.reject(new Error(msg.error))
        }
        break
      }
    }
  }
}

// Singleton instance
export const agentManager = new AgentManager()
