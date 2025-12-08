import { NodeId } from '@form-engine/core/types/engine.type'
import { ActionTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult, CapturedEffect } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { commitPendingEffects } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Result of an action transition evaluation
 */
export interface ActionTransitionResult {
  /**
   * Whether the action was executed (when predicate passed)
   */
  executed: boolean
}

/**
 * Handler for Action Transition nodes
 *
 * Evaluates onAction transitions by:
 * 1. Checking the when predicate (required - must match to execute)
 * 2. Capturing and immediately committing effects
 *
 * ## Purpose
 * onAction transitions handle "in-page actions" like postcode lookups.
 * They run on POST requests BEFORE block evaluation, allowing effects
 * to set answers that blocks then display.
 *
 * ## Execution Pattern
 * 1. Evaluate when predicate
 * 2. If when fails -> return { executed: false }
 * 3. If when passes -> capture effects -> commit immediately -> return { executed: true }
 *
 * ## Wiring Pattern
 * - when -> transition (must evaluate before transition)
 * - effects are chained: effect[0] -> effect[1] -> transition
 *
 * ## First-Match Semantics
 * Only the first matching onAction executes (controlled by LifecycleCoordinator).
 * This handler just evaluates a single transition; the coordinator handles iteration.
 */
export default class ActionTransitionHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ActionTransitionASTNode,
  ) {}

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<ActionTransitionResult>> {
    const whenPassed = await this.evaluateWhenPredicate(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
        },
      }
    }

    const effects = this.node.properties.effects as FunctionASTNode[]

    if (Array.isArray(effects) && effects.length > 0) {
      const results = await Promise.all(effects.map(effect => invoker.invoke<CapturedEffect>(effect.id, context)))

      const capturedEffects = results.filter(result => !result.error && result.value).map(result => result.value!)

      await commitPendingEffects(capturedEffects, context)
    }

    return {
      value: {
        executed: true,
      },
    }
  }

  /**
   * Evaluate the when predicate
   * Returns true if predicate passes, false otherwise
   *
   * Note: when is required for ActionTransition (always has a trigger condition)
   */
  private async evaluateWhenPredicate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<boolean> {
    const when = this.node.properties.when

    if (!isASTNode(when)) {
      return false
    }

    const result = await invoker.invoke(when.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }
}
