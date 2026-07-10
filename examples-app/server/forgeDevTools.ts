import type { Server as HttpServer } from 'node:http'
import type { ForgeInstrumentationSink } from '@ministryofjustice/hmpps-forge/core'
import { setUpForgeDevTools } from '@ministryofjustice/hmpps-forge/devtools'
import config from './config'
import logger from './logger'
import { createRedisClient } from './data/redisClient'

const forgeDevTools = setUpForgeDevTools({
  logger,
  noAuth: !config.production,
  redis: config.redis.enabled ? createRedisClient() : undefined,
})

export const forgeDevToolsInstrumentationSink: ForgeInstrumentationSink = forgeDevTools

export function attachForgeDevTools(httpServer: HttpServer): void {
  forgeDevTools.attach(httpServer)
}
