import type { RequestSnapshot } from './snapshot.type'
import type { RequestTrace } from '../../engine/contracts/trace/requestTrace.type'

/**
 * The envelope emitted for one completed traced request: the snapshot that was
 * evaluated and its sealed decision log. The snapshot supplies the request
 * identity (node, method, location) that the trace itself deliberately omits.
 */
export interface RequestTraceEvent {
  readonly snapshot: RequestSnapshot
  readonly trace: RequestTrace
}

/**
 * Receives per-request decision logs from a `ForgeOrchestrator`. Implement
 * this to consume traces explicitly; omit it and the orchestrator defaults to
 * publishing on the `forge:request:complete` diagnostics channel.
 */
export interface TraceObserver {
  /**
   * Asked once per pipeline-bound request, before any recording. Returning
   * false means no recorder is created and the request runs at zero trace
   * cost. Requests that fail before reaching a pipeline (unknown node,
   * unsupported method) are never offered.
   */
  shouldTrace(snapshot: RequestSnapshot): boolean

  /**
   * Fires once per traced request after the trace is sealed — on render,
   * redirect, and error paths alike. Thrown errors are not swallowed by the
   * orchestrator, so implementations own their failure mode.
   */
  onTrace(event: RequestTraceEvent): void
}
