import { NodeId } from '@form-engine/core/types/engine.type'
import { ActionTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult, CapturedEffect } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Result of an action transition evaluation
 */
export interface ActionTransitionResult {
  /**
   * Whether the action was executed (when predicate passed)
   */
  executed: boolean

  /**
   * Captured effects to be committed by LifecycleCoordinator
   * Effects are captured with their evaluated arguments, deferred for commit
   */
  effects: CapturedEffect[]
}

/**
 * Handler for Action Transition nodes
 *
 * Evaluates onAction transitions by:
 * 1. Checking the when predicate (required - must match to execute)
 * 2. Capturing effects and returning them for LifecycleCoordinator to commit
 *
 * ## Purpose
 * onAction transitions handle "in-page actions" like postcode lookups.
 * They run on POST requests BEFORE block evaluation, allowing effects
 * to set answers that blocks then display.
 *
 * ## Execution Pattern
 * 1. Evaluate when predicate
 * 2. If when fails -> return { executed: false, effects: [] }
 * 3. If when passes -> capture effects -> return { executed: true, effects }
 *
 * LifecycleCoordinator commits ACTION effects immediately after evaluation
 * to ensure answers are set before blocks evaluate.
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
          effects: [],
        },
      }
    }

    const capturedEffects = await this.captureEffects(context, invoker)

    return {
      value: {
        executed: true,
        effects: capturedEffects,
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

  /**
   * Capture effects by invoking their handlers
   *
   * Invokes EffectHandler for each effect to get CapturedEffect.
   * Returns captured effects for LifecycleCoordinator to commit.
   */
  private async captureEffects(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<CapturedEffect[]> {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return []
    }

    const effectNodes = effects.filter(isASTNode)
    const results = await Promise.all(effectNodes.map(effect => invoker.invoke<CapturedEffect>(effect.id, context)))

    return results.filter(result => !result.error && result.value).map(result => result.value!)
  }
}
