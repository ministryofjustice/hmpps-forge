import DevToolsServer from './DevToolsServer'

const DEFAULT_PATH = '/__forge-devtools'

export interface ForgeDevToolsOptions {
  readonly path?: string
  readonly logger?: { info(message: string): void }
  readonly noAuth?: boolean
}

/**
 * Creates the Forge DevTools bridge. Call once at app startup, attach it to
 * the app's HTTP server, and pass it into Forge's instrumentation sinks.
 */
export function setUpForgeDevTools(options?: ForgeDevToolsOptions): DevToolsServer {
  const path = options?.path ?? DEFAULT_PATH
  const logger = options?.logger ?? console

  return new DevToolsServer({ path, logger, noAuth: options?.noAuth })
}
