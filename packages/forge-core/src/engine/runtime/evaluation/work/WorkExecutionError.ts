import type WorkUnit from './WorkUnit'

/**
 * Thrown by `WorkExecutor.executeWithUnit` when execution fails mid-tree. It
 * carries the begun-but-not-completed root work unit so `RequestEvaluator` can
 * serialize the partial work tree into the failed phase's trace, and the
 * original error so callers can unwrap it.
 */
export default class WorkExecutionError extends Error {
  constructor(
    readonly original: unknown,
    readonly workUnit: WorkUnit,
  ) {
    super(original instanceof Error ? original.message : String(original))
    this.name = 'WorkExecutionError'
  }
}
