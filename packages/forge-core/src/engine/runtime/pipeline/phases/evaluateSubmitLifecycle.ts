import type { NodeId } from '../../../contracts/ast/ast.type'
import type { SubmitLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledSubmitHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { HookLifecycleContext } from '../../../contracts/compiled/phaseContexts.type'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureAsyncScopedFrom } from '../trace/TraceRecorder'

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
 * ran and record nothing. `recordHookSnapshot` is invoked only for the executed
 * hook - skipped hooks' guards cannot mutate state, so the phase snapshots the
 * context only where it can have changed.
 */
export async function evaluateSubmitLifecycle(
  plan: SubmitLifecyclePlan,
  ctx: HookLifecycleContext,
  trace?: TraceRecorder,
  recordHookSnapshot?: (nodeId: NodeId) => void,
  recordEffectSnapshot?: (hookNodeId: NodeId, effectName: string) => void,
): Promise<CompiledSubmitHookResult> {
  for (const entry of plan.submitHooks) {
    if (trace) {
      ctx.runEffect = async (name, thunk) => {
        await thunk()
        recordEffectSnapshot?.(entry.nodeId, name)
      }
    }

    const result = await measureAsyncScopedFrom(
      trace,
      r => ({
        kind: 'submit-hook',
        nodeId: entry.nodeId,
        executed: r.executed,
        validated: r.validated,
        outcome: r.outcome,
        redirect: r.redirect,
        status: r.status,
        message: r.message,
      }),
      () => entry.evaluate(ctx),
    )

    if (result.executed) {
      recordHookSnapshot?.(entry.nodeId)

      return result
    }
  }

  return { executed: false, validated: false, outcome: 'continue' }
}
