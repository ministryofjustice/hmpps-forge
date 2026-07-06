import type { IncomingMessage, Server as HttpServer } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ForgeInstrumentationSink, RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'
import DevToolsSession from './session/DevToolsSession'
import TraceDispatcher from './trace/TraceDispatcher'
import { extractDevToolsCookie } from './trace/devToolsCookie'
import type RedisTraceChannel from './trace/RedisTraceChannel'

export interface DevToolsServerOptions {
  readonly path: string
  readonly logger: { info(message: string): void }
  readonly noAuth?: boolean
  readonly redisChannel?: RedisTraceChannel
}

interface ClientMessage {
  readonly type: string
  readonly code?: string
}

/**
 * WebSocket server that authenticates devtools clients via a one-time code
 * and delegates trace delivery to a {@link TraceDispatcher}.
 */
export default class DevToolsServer implements ForgeInstrumentationSink {
  private readonly wss: WebSocketServer

  private readonly dispatcher = new TraceDispatcher()

  private readonly logger: DevToolsServerOptions['logger']

  private readonly webSocketPath: string

  private readonly noAuth: boolean

  private readonly redisChannel?: RedisTraceChannel

  private attachedServer?: HttpServer

  private redisStarted = false

  constructor(options: DevToolsServerOptions) {
    this.logger = options.logger
    this.webSocketPath = normalizeWebSocketPath(options.path)
    this.noAuth = options.noAuth ?? false
    this.redisChannel = options.redisChannel

    this.wss = new WebSocketServer({
      noServer: true,
      // Context takeover keeps the deflate window across messages on a
      // connection, so each trace compresses against earlier ones (~11x
      // measured); the threshold skips tiny auth/heartbeat frames.
      perMessageDeflate: {
        threshold: 1024,
        serverNoContextTakeover: false,
      },
    })
    this.wss.on('connection', ws => this.handleConnection(ws))
  }

  attach(server: HttpServer): void {
    this.detach()
    this.attachedServer = server
    server.on('upgrade', this.handleUpgrade)
    this.startRedisChannel()
    this.logger.info(`Forge DevTools WebSocket server attached at ${this.webSocketPath}`)
  }

  detach(): void {
    this.attachedServer?.off('upgrade', this.handleUpgrade)
    this.attachedServer = undefined
  }

  close(): void {
    this.detach()
    this.dispatcher.closeAll()
    this.wss.close()
    this.redisChannel?.close()
  }

  onRequestTrace(event: RequestTraceEvent): void {
    if (!this.redisChannel) {
      this.dispatcher.onRequestTrace(event)

      return
    }

    // Redis mode has one delivery path: publish even our own traces and hear
    // them back through the subscription, like every other pod's.
    this.redisChannel.publish(event)
  }

  shouldTrace(snapshot: RequestTraceEvent['snapshot']): boolean {
    return extractDevToolsCookie(snapshot) !== undefined
  }

  private async startRedisChannel(): Promise<void> {
    if (!this.redisChannel || this.redisStarted) {
      return
    }

    this.redisStarted = true
    await this.redisChannel.connect()
    await this.redisChannel.subscribe(event => this.dispatcher.onRequestTrace(event))
  }

  private readonly handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    if (!this.isDevToolsUpgrade(request)) {
      return
    }

    this.wss.handleUpgrade(request, socket, head, ws => {
      this.wss.emit('connection', ws, request)
    })
  }

  private isDevToolsUpgrade(request: IncomingMessage): boolean {
    const url = new URL(request.url ?? '/', 'http://localhost')

    return url.pathname === this.webSocketPath
  }

  private handleConnection(ws: WebSocket): void {
    const session = new DevToolsSession(ws)
    this.dispatcher.addSession(session)

    if (this.noAuth) {
      session.authenticateImmediately()
      this.logger.info(`DevTools client ${session.getId()} connected (auth disabled)`)
    } else {
      this.logCodeIssued(session)
      session.sendChallenge()
    }

    ws.on('message', (raw: Buffer) => {
      const message = parseMessage(raw)

      if (!message) {
        return
      }

      if (message.type === 'heartbeat:ping') {
        session.send({ type: 'heartbeat:pong' })

        return
      }

      if (message.type === 'auth:code' && message.code) {
        const result = session.handleAuthCode(message.code)

        if (result === 'valid') {
          this.logger.info(`DevTools client ${session.getId()} authenticated`)
        }
      }

      if (message.type === 'auth:refresh') {
        session.refreshCode()
        this.logCodeIssued(session)
      }
    })

    ws.on('close', () => {
      this.dispatcher.removeSession(session)
      this.logger.info(`DevTools client ${session.getId()} disconnected`)
    })
  }

  private logCodeIssued(session: DevToolsSession): void {
    const expiresIn = Math.ceil(session.getCodeExpiresIn() / 60_000)

    this.logger.info(
      `DevTools client ${session.getId()} — auth code: \x1b[1m${session.getCode()}\x1b[0m (expires in ${expiresIn}m)`,
    )
  }
}

function normalizeWebSocketPath(path: string): string {
  const withoutTrailingSlash = path.endsWith('/') ? path.slice(0, -1) : path
  const normalizedBasePath = withoutTrailingSlash.startsWith('/') ? withoutTrailingSlash : `/${withoutTrailingSlash}`

  return `${normalizedBasePath}/ws`
}

function parseMessage(raw: Buffer): ClientMessage | undefined {
  try {
    return JSON.parse(raw.toString()) as ClientMessage
  } catch {
    return undefined
  }
}
