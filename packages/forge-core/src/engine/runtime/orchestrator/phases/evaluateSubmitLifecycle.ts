import type { SubmitLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledSubmitHookResult, HookLifecycleContext } from '../../../contracts/runtime/hookLifecycle.type'

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
