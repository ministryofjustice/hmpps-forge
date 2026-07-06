import { gunzipSync, gzipSync } from 'node:zlib'
import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'

const TRACE_CHANNEL = '__forgeDevtools:traces'

/**
 * Minimal structural view of a node-redis v4 client. The package takes no
 * dependency on `redis`; any client with this shape (the HMPPS template's)
 * satisfies it, so local-only users never pull `redis` in.
 */
export interface DevToolsRedisClient {
  duplicate(): DevToolsRedisClient
  connect(): Promise<unknown>
  publish(channel: string, message: string | Buffer): Promise<unknown>
  subscribe(channel: string, listener: (message: Buffer) => void, bufferMode: true): Promise<unknown>
  quit(): Promise<unknown>
}

interface RedisChannelLogger {
  warn(message: string): void
}

/**
 * Carries request traces between app replicas over Redis pub/sub, so whichever
 * pod holds the panel's websocket sees every pod's traces rather than only the
 * slice that lands on it. Redis being down just means missing traces, so every
 * operation logs and swallows its failure instead of crashing the app.
 */
export default class RedisTraceChannel {
  private readonly publisher: DevToolsRedisClient

  private readonly subscriber: DevToolsRedisClient

  constructor(
    client: DevToolsRedisClient,
    private readonly logger: RedisChannelLogger,
  ) {
    // A node-redis client in subscriber mode can't issue other commands, so the
    // caller's client is never used directly - each role gets its own duplicate
    // whose lifecycle this channel owns.
    this.publisher = client.duplicate()
    this.subscriber = client.duplicate()
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()])
    } catch (error) {
      this.logger.warn(`Forge DevTools Redis channel failed to connect: ${this.describe(error)}`)
    }
  }

  async publish(event: RequestTraceEvent): Promise<void> {
    try {
      // Sync gzip is acceptable here: traces average ~4 KB gzipped and publish at
      // human clicking speed, so the event-loop stall is negligible.
      const payload = gzipSync(JSON.stringify(event))
      await this.publisher.publish(TRACE_CHANNEL, payload)
    } catch (error) {
      this.logger.warn(`Forge DevTools Redis publish failed: ${this.describe(error)}`)
    }
  }

  async subscribe(onEvent: (event: RequestTraceEvent) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(TRACE_CHANNEL, message => this.deliver(message, onEvent), true)
    } catch (error) {
      this.logger.warn(`Forge DevTools Redis subscribe failed: ${this.describe(error)}`)
    }
  }

  async close(): Promise<void> {
    try {
      await Promise.all([this.publisher.quit(), this.subscriber.quit()])
    } catch (error) {
      this.logger.warn(`Forge DevTools Redis channel failed to close: ${this.describe(error)}`)
    }
  }

  private deliver(message: Buffer, onEvent: (event: RequestTraceEvent) => void): void {
    try {
      const event = JSON.parse(gunzipSync(message).toString()) as RequestTraceEvent

      onEvent(event)
    } catch (error) {
      // A malformed or truncated message must never take the listener down.
      this.logger.warn(`Forge DevTools Redis dropped a malformed trace: ${this.describe(error)}`)
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
