import { channel } from 'node:diagnostics_channel'
import type { TraceObserver } from '../../../../framework/types/traceObserver.type'

/**
 * The diagnostics channel name request traces are published on. Tooling
 * subscribes to this name without importing forge at all — the string is the
 * whole contract between publisher and subscriber.
 */
export const FORGE_REQUEST_COMPLETE_CHANNEL = 'forge:request:complete'

/**
 * The orchestrator's default trace observer: publishes each completed
 * request's {@link RequestTraceEvent} on a diagnostics channel, gated by
 * `hasSubscribers` so an idle channel costs one boolean read per request and
 * no recorder is ever constructed. This is what lets external tooling (e.g. a
 * preloaded devtools bridge) attach without the app passing anything in —
 * subscribing mid-run starts producing traces on the next request, and
 * unsubscribing stops them. `publish` isolates subscriber exceptions, so a
 * faulty subscriber cannot break the request path.
 */
export function createChannelTraceObserver(): TraceObserver {
  const requestComplete = channel(FORGE_REQUEST_COMPLETE_CHANNEL)

  return {
    shouldTrace: () => requestComplete.hasSubscribers,
    onTrace: event => {
      requestComplete.publish(event)
    },
  }
}
