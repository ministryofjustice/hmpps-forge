import type TraceSpan from '../tracing/TraceSpan'

/**
 * Thrown by `WorkExecutor.executeWithUnit` when execution fails mid-tree. It
 * carries the begun-but-not-completed root trace span so `RequestPipeline` can
 * serialize the partial work tree into the failed phase's trace, and the
 * original error so callers can unwrap it.
 */
export default class WorkExecutionError extends Error {
  constructor(
    readonly original: unknown,
    readonly traceSpan: TraceSpan,
  ) {
    super(original instanceof Error ? original.message : String(original))
    this.name = 'WorkExecutionError'
  }
}
