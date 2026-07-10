import DevToolsServer from './DevToolsServer'
import RedisTraceChannel, { type DevToolsRedisClient } from './trace/RedisTraceChannel'

const DEFAULT_PATH = '/__forge-devtools'

export interface ForgeDevToolsOptions {
  readonly path?: string
  readonly logger?: { info(message: string): void; warn(message: string): void }
  readonly noAuth?: boolean
  readonly redis?: DevToolsRedisClient
}

/**
 * Creates the Forge DevTools bridge. Call once at app startup, attach it to
 * the app's HTTP server, and pass it into Forge's instrumentation sinks.
 *
 * Pass a `redis` client to run in multi-instance mode: traces are published to
 * the app's Redis so whichever replica holds the panel's websocket sees every
 * replica's traces. Omit it for today's in-process, single-instance behaviour.
 */
export function setUpForgeDevTools(options?: ForgeDevToolsOptions): DevToolsServer {
  const path = options?.path ?? DEFAULT_PATH
  const logger = options?.logger ?? console
  const redisChannel = options?.redis ? new RedisTraceChannel(options.redis, logger) : undefined

  return new DevToolsServer({ path, logger, noAuth: options?.noAuth, redisChannel })
}
