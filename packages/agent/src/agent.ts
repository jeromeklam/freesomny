import WebSocket from 'ws'
import { executeLocalRequest, type RequestPayload, type HttpResponse } from './http-engine.js'

interface AgentOptions {
  serverUrl: string
  email: string
  password: string
  agentName: string
  autoReconnect: boolean
}

interface ExecuteRequestMessage {
  type: 'execute-request'
  requestId: string
  payload: RequestPayload
}

interface RegisteredMessage {
  type: 'registered'
  agentId: string
}

type ServerMessage = ExecuteRequestMessage | RegisteredMessage

export async function startAgent(options: AgentOptions): Promise<void> {
  // Step 1: Authenticate
  console.log(`Authenticating as ${options.email}...`)
  const loginRes = await fetch(`${options.serverUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: options.email, password: options.password }),
  })

  const loginData = await loginRes.json() as { data?: { token: string }; error?: string }
  if (loginData.error || !loginData.data?.token) {
    console.error('Authentication failed:', loginData.error || 'No token received')
    process.exit(1)
  }

  const token = loginData.data.token
  console.log('Authenticated successfully.')

  // Step 2: Connect WebSocket
  const wsUrl = options.serverUrl.replace(/^http/, 'ws')
  const wsFullUrl = `${wsUrl}/api/ws/agent?token=${encodeURIComponent(token)}&name=${encodeURIComponent(options.agentName)}`

  function connect(): void {
    console.log(`Connecting to ${options.serverUrl}...`)
    const ws = new WebSocket(wsFullUrl)

    ws.on('open', () => {
      console.log(`Connected as agent "${options.agentName}".`)
      console.log('Waiting for requests... (Ctrl+C to stop)')
    })

    ws.on('message', async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as ServerMessage

        if (msg.type === 'registered') {
          console.log(`Agent registered with ID: ${msg.agentId}`)
          return
        }

        if (msg.type === 'execute-request') {
          const payload = msg.payload
          console.log(`  -> ${payload.method} ${payload.url}`)

          try {
            const response: HttpResponse = await executeLocalRequest(payload)
            ws.send(JSON.stringify({
              type: 'request-response',
              requestId: msg.requestId,
              payload: response,
            }))
            console.log(`  <- ${response.status} (${response.time}ms, ${response.size} bytes)`)
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              requestId: msg.requestId,
              error: error instanceof Error ? error.message : 'Unknown error',
            }))
            console.error(`  <- Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      } catch {
        // Invalid message, ignore
      }
    })

    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`Disconnected (code: ${code}, reason: ${reason?.toString() || 'none'})`)
      if (options.autoReconnect && code !== 4001 && code !== 4002) {
        console.log('Reconnecting in 5 seconds...')
        setTimeout(connect, 5000)
      } else if (code === 4001) {
        console.error('Missing authentication token.')
        process.exit(1)
      } else if (code === 4002) {
        console.error('Invalid authentication token. Please check your credentials.')
        process.exit(1)
      }
    })

    ws.on('error', (err: Error) => {
      console.error('WebSocket error:', err.message)
    })

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }))
      } else {
        clearInterval(heartbeat)
      }
    }, 30000)
  }

  connect()
}
