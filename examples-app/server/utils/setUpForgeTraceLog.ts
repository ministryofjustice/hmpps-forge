import { subscribe } from 'node:diagnostics_channel'
import { createWriteStream, type WriteStream } from 'node:fs'
import { FORGE_REQUEST_COMPLETE_CHANNEL } from '@ministryofjustice/hmpps-forge/core'
import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core/framework'
import logger from '../logger'

/**
 * Demo consumer of the forge trace channel. Subscribing is what switches
 * tracing on — the engine records nothing while the channel has no
 * subscribers — and every completed request is appended to an NDJSON file,
 * one line per request with its full phase-by-phase decision log.
 */
export default function setUpForgeTraceLog(filePath: string = 'forge-traces.ndjson'): void {
  let traceFileStream: WriteStream | undefined

  subscribe(FORGE_REQUEST_COMPLETE_CHANNEL, message => {
    // diagnostics_channel messages are untyped; only the forge engine publishes on this channel.
    const { snapshot, trace } = message as RequestTraceEvent

    traceFileStream ??= createWriteStream(filePath, { flags: 'a' })
    traceFileStream.write(
      `${JSON.stringify({
        loggedAt: new Date().toISOString(),
        method: snapshot.method,
        nodeId: snapshot.nodeId,
        pathname: snapshot.location.pathname,
        trace,
      })}\n`,
    )
  })

  logger.info(`Forge request traces appending to ${filePath}`)
}
