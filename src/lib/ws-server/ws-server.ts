import WebSocket from 'ws'
import { logger } from '@util'

type Payload = Record<string, any> | any

export class WsServer {
  private server: WebSocket.Server
  private actions: Map<string, (payload: Payload) => void> = new Map()

  constructor(port?: number) {
    if (process.env.MODE === 'service') return

    port = port ? port : this.getPort()
    this.server = new WebSocket.Server({ port }, () => {
      logger.info(`WebSocket server running on ws://localhost:${port}`)
    })
  }

  public init() {
    if (process.env.MODE === 'service') return

    this.server.on('connection', (ws) => ws.on('message', this.handleMessage))
  }

  public broadcast(action: string, payload: Payload) {
    if (process.env.MODE === 'service') return

    this.server.clients.forEach((ws) => ws.send(JSON.stringify({ action, payload })))
  }

  public registerAction(actionName: string, actionFn: (payload: Payload) => void) {
    if (process.env.MODE === 'service') return

    if (this.actions.has(actionName)) return

    this.actions.set(actionName, actionFn)
  }

  private handleMessage = (raw: string | Buffer) => {
    const body = raw.toString()
    try {
      const parsed = JSON.parse(body)
      if (!parsed.action) return this.broadcast('error', { error: 'Invalid input: "action" missing' })
      if (!/^get-/.test(parsed.action) && !parsed.payload) return this.broadcast('error', { error: 'Invalid input: "payload" missing' })

      const { action, payload } = parsed
      if (!this.actions.has(action)) return

      this.actions.get(action)(payload)
    } catch (e) {
      this.broadcast('error', { error: `Invalid input: ${e.message}` })
    }
  }

  private getPort() {
    return process.env.WS_PORT ? Number(process.env.WS_PORT) : 19807
  }
}
