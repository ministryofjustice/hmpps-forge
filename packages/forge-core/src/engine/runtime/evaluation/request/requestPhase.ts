import { isWorkTaskOfKind, singleTaskGroup } from '../work/workTask'
import type { WorkContextContract, WorkGroup, WorkInstrumentation } from '../../../contracts/runtime/work.type'
import type { WorkKind } from '../../../contracts/runtime/workOutput.type'
import { captureContextSnapshot } from '../work/tracing/contextSnapshot'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

/**
 * Awaits a compiled work task, asserts its kind, and wraps it as the phase's child
 * work. The task-resolving phases (access, answer-preparation, reachability,
 * submit, resolve) all share this tail — they differ only in how they build the
 * compiled context and which kind they expect.
 */
export async function runTaskPhase(
  task: unknown,
  kind: WorkKind,
  invalidMessage: string,
): Promise<{ readonly groups: readonly WorkGroup[] }> {
  const resolved = await task

  if (!isWorkTaskOfKind(resolved, kind)) {
    throw new Error(invalidMessage)
  }

  return singleTaskGroup(resolved)
}

/**
 * The shared after-phase instrumentation: every request phase snapshots the
 * request context on completion. A generic function rather than a const because
 * `WorkInstrumentation` ties the ctx to the phase's props.
 */
export function phaseInstrumentation<TProps>(): WorkInstrumentation<TProps, PhaseWorkOutput> {
  return {
    resolveTraceMetadataAtStart() {
      return undefined
    },

    resolveTraceMetadataAtFinish(ctx: WorkContextContract<RequestExecutionContext, TProps>) {
      return captureContextSnapshot(ctx.request.context)
    },
  }
}
