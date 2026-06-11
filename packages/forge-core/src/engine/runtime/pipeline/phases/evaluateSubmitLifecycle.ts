import type { SubmitLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledSubmitHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { HookLifecycleContext } from '../../../contracts/compiled/phaseContexts.type'
import type TraceRecorder from '../trace/TraceRecorder'

/**
 * Runs a step's submit hooks in declared order, returning the result of the
 * first hook whose guard let it execute. Each hook's `evaluate` reports
 * `executed: false` when its guard skipped it, so iteration continues past
 * skipped hooks; the first executed hook short-circuits and its result (carrying
 * the `outcome` that drives the submit-lifecycle phase) is returned. When no
 * hook executes, a default skipped, unvalidated, `continue` result is returned.
 *
 * When a trace recorder is supplied, one decision is recorded per hook
 * evaluated — skipped hooks included; hooks after the first executed one never
 * ran and record nothing.
 */
export async function evaluateSubmitLifecycle(
  plan: SubmitLifecyclePlan,
  ctx: HookLifecycleContext,
  trace?: TraceRecorder,
): Promise<CompiledSubmitHookResult> {
  for (const entry of plan.submitHooks) {
    const startedAt = performance.now()
    const result = await entry.evaluate(ctx)

    trace?.record({
      kind: 'submit-hook',
      nodeId: entry.nodeId,
      executed: result.executed,
      validated: result.validated,
      outcome: result.outcome,
      redirect: result.redirect,
      status: result.status,
      message: result.message,
      durationMs: performance.now() - startedAt,
    })

    if (result.executed) {
      return result
    }
  }

  return { executed: false, validated: false, outcome: 'continue' }
}
