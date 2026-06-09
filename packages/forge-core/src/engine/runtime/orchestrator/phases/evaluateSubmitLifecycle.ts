import type { SubmitLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledSubmitHookResult, HookLifecycleContext } from '../../../contracts/runtime/hookLifecycle.type'

/**
 * Runs a step's submit hooks in declared order, returning the result of the
 * first hook whose guard let it execute. Each hook's `evaluate` reports
 * `executed: false` when its guard skipped it, so iteration continues past
 * skipped hooks; the first executed hook short-circuits and its result (carrying
 * the `outcome` that drives the submit phase) is returned. When no hook
 * executes, a default skipped, unvalidated, `continue` result is returned.
 */
export async function evaluateSubmitLifecycle(
  plan: SubmitLifecyclePlan,
  ctx: HookLifecycleContext,
): Promise<CompiledSubmitHookResult> {
  for (const entry of plan.hooks) {
    const result = await entry.evaluate(ctx)

    if (result.executed) {
      return result
    }
  }

  return { executed: false, validated: false, outcome: 'continue' }
}
