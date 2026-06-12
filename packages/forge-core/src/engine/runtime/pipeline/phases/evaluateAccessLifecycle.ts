import type { NodeId } from '../../../contracts/ast/ast.type'
import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledAccessHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { HookLifecycleContext } from '../../../contracts/compiled/phaseContexts.type'
import type TraceRecorder from '../trace/TraceRecorder'

/**
 * Runs each compiled access hook in plan order, short-circuiting at the first
 * hook whose outcome is not `'continue'` (a `'redirect'` or `'error'`) and
 * returning that result so the access-lifecycle phase can halt. When every hook
 * permits continuation (or there are no hooks), returns a synthesized
 * `{ executed: true, outcome: 'continue' }`. Hooks read and may mutate `ctx`,
 * and are awaited so a hook compiled as async resolves before the next runs.
 *
 * When a trace recorder is supplied, one decision is recorded per hook run —
 * the halting hook included; hooks after the halt never ran and record nothing.
 * `recordHookSnapshot` is invoked after each hook's decision is recorded so the
 * phase can snapshot the context state that hook left behind.
 */
export async function evaluateAccessLifecycle(
  plan: AccessLifecyclePlan,
  ctx: HookLifecycleContext,
  trace?: TraceRecorder,
  recordHookSnapshot?: (nodeId: NodeId) => void,
): Promise<CompiledAccessHookResult> {
  for (const entry of plan.accessHooks) {
    const startedAt = performance.now()
    const result = await entry.evaluate(ctx)

    trace?.record({
      kind: 'access-hook',
      nodeId: entry.nodeId,
      outcome: result.outcome,
      redirect: result.redirect,
      status: result.status,
      message: result.message,
      durationMs: performance.now() - startedAt,
    })
    recordHookSnapshot?.(entry.nodeId)

    if (result.outcome !== 'continue') {
      return result
    }
  }

  return { executed: true, outcome: 'continue' }
}
