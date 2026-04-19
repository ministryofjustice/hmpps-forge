import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { AccessHookResult } from '../../nodes/hooks/access/AccessHandler'
import { ActionHookResult } from '../../nodes/hooks/action/ActionHandler'
import { SubmitHookResult } from '../../nodes/hooks/submit/SubmitHandler'
import { AccessHookASTNode } from '../../types/expressions.type'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'

interface AccessRuntimeInputs {
  accessAncestorIds: NodeId[]
}

/**
 * HookExecutor - Runs lifecycle hooks for form steps
 *
 * Pure hook orchestration: iterates hook arrays with the correct
 * semantics (halt / first-match) and returns the existing result types.
 * Does not own ancestor resolution, static-data merging, redirects, or rendering.
 *
 * ## Access hooks
 * Runs an ancestor's onAccess array in sequence. Invocation errors are
 * warned and skipped. Halts on redirect or error outcome.
 *
 * ## Action hooks
 * First-match semantics: stops at the first hook that executes.
 *
 * ## Submit hooks
 * First-match semantics: stops at the first hook that executes.
 */
export default class HookExecutor {
  constructor(private readonly logger: JourneyInstanceDependencies['logger']) {}

  /**
   * Run the full access lifecycle for a step: resolve ancestors, then run
   * onAccess hooks for each ancestor in outer-to-inner order.
   *
   * Static data merging should be done via ContextPreparer.prepare() before calling this.
   *
   * @returns The first halting result (redirect/error), or 'continue' if all ancestors pass
   */
  async executeAccessLifecycle(
    runtimePlan: AccessRuntimeInputs,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<AccessHookResult> {
    const ancestors = runtimePlan.accessAncestorIds
      .map(nodeId => context.nodeRegistry.get(nodeId) as JourneyASTNode)

    for (const ancestor of ancestors) {

      const result = await this.executeAccessHooks(ancestor, invoker, context)

      if (result.outcome === 'redirect' || result.outcome === 'error') {
        return result
      }
    }

    return { executed: true, outcome: 'continue' }
  }

  /**
   * Run onAccess hooks for a single ancestor (journey or step).
   *
   * Invocation errors are warned and skipped.
   * Non-executed hooks (when condition was false) are skipped.
   * Halts on redirect or error outcome.
   *
   * @returns The first halting result (redirect/error), or a 'continue' result if all pass
   */
  async executeAccessHooks(
    ancestor: JourneyASTNode | StepASTNode,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<AccessHookResult> {
    const hooks: AccessHookASTNode[] = ancestor.properties.onAccess ?? []

    for (const hook of hooks) {

      const result = await invoker.invoke<AccessHookResult>(hook.id, context)

      if (result.error) {
        this.logger.warn(`Access hook error: ${result.error.message}`)

        continue
      }

      if (!result.value?.executed) {

        continue
      }

      if (result.value.outcome === 'redirect' || result.value.outcome === 'error') {
        return result.value
      }
    }

    return { executed: true, outcome: 'continue' }
  }

  /**
   * Run onAction hooks for a step with first-match semantics.
   */
  async executeActionHooks(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<ActionHookResult> {
    for (const hookId of runtimePlan.actionHookIds) {

      const result = await invoker.invoke<ActionHookResult>(hookId, context)

      if (!result.error && result.value?.executed) {
        return result.value
      }
    }

    return { executed: false }
  }

  /**
   * Run onSubmission hooks for a step with first-match semantics.
   */
  async executeSubmitHooks(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<SubmitHookResult> {
    for (const hookId of runtimePlan.submitHookIds) {

      const result = await invoker.invoke<SubmitHookResult>(hookId, context)

      if (!result.error && result.value?.executed) {
        return result.value
      }
    }

    return { executed: false, validated: false, outcome: 'continue' }
  }
}
