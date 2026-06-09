import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledAccessHookResult, HookLifecycleContext } from '../../../contracts/runtime/hookLifecycle.type'

/**
 * Runs each compiled access hook in plan order, short-circuiting at the first
 * hook whose outcome is not `'continue'` (a `'redirect'` or `'error'`) and
 * returning that result so the access-lifecycle phase can halt. When every hook
 * permits continuation (or there are no hooks), returns a synthesized
 * `{ executed: true, outcome: 'continue' }`. Hooks read and may mutate `ctx`,
 * and are awaited so a hook compiled as async resolves before the next runs.
 */
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
