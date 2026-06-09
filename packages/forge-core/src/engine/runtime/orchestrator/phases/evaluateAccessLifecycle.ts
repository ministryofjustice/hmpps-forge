import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledAccessHookResult, HookLifecycleContext } from '../../../contracts/runtime/hookLifecycle.type'

export async function evaluateAccessLifecycle(
  plan: AccessLifecyclePlan,
  ctx: HookLifecycleContext,
): Promise<CompiledAccessHookResult> {
  for (const entry of plan.hooks) {
    const result = await entry.evaluate(ctx)

    if (result.outcome !== 'continue') {
      return result
    }
  }

  return { executed: true, outcome: 'continue' }
}
