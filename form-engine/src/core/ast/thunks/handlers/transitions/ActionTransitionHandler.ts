import { NodeId } from '@form-engine/core/types/engine.type'
import { ActionTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  CapturedEffect,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
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
   * Captured effects to be committed by controller
   * Effects are captured with their evaluated arguments, deferred for commit
   */
  pendingEffects?: CapturedEffect[]
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
export default class ActionTransitionHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ActionTransitionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { when, effects } = this.node.properties

    // Check when predicate
    if (isASTNode(when)) {
      const handler = deps.thunkHandlerRegistry.get(when.id)
      if (handler?.isAsync ?? true) {
        this.isAsync = true
        return
      }
    }

    // Check effects
    if (effects && Array.isArray(effects)) {
      const hasAsyncEffect = effects.filter(isASTNode).some(effect => {
        const handler = deps.thunkHandlerRegistry.get(effect.id)
        return handler?.isAsync ?? true
      })
      if (hasAsyncEffect) {
        this.isAsync = true
        return
      }
    }

    this.isAsync = false
  }

  evaluateSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): HandlerResult<ActionTransitionResult> {
    const whenPassed = this.evaluateWhenPredicateSync(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
          pendingEffects: [],
        },
      }
    }

    const capturedEffects = this.captureEffectsSync(context, invoker)

    return {
      value: {
        executed: true,
        pendingEffects: capturedEffects,
      },
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<ActionTransitionResult>> {
    const whenPassed = await this.evaluateWhenPredicate(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
          pendingEffects: [],
        },
      }
    }

    const capturedEffects = await this.captureEffects(context, invoker)

    return {
      value: {
        executed: true,
        pendingEffects: capturedEffects,
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

  // Sync versions of private methods

  private evaluateWhenPredicateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): boolean {
    const when = this.node.properties.when

    if (!isASTNode(when)) {
      return false
    }

    const result = invoker.invokeSync(when.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  private captureEffectsSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): CapturedEffect[] {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return []
    }

    return effects
      .filter(isASTNode)
      .map(effect => invoker.invokeSync<CapturedEffect>(effect.id, context))
      .filter(result => !result.error && result.value)
      .map(result => result.value!)
  }
}
