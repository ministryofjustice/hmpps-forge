import { NodeId } from '../../../types/engine.type'
import { ActionHookASTNode, FunctionASTNode } from '../../../types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
  ThunkError,
} from '../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'
import { isASTNode } from '../../../typeguards/nodes'

/**
 * Result of an action hook evaluation
 */
export interface ActionHookResult {
  /**
   * Whether the action was executed (when predicate passed)
   */
  executed: boolean
}

/**
 * Handler for Action Hook nodes
 *
 * Evaluates onAction hooks by:
 * 1. Checking the when predicate (required - must match to execute)
 * 2. Pushing @hookType: 'action' onto scope for effect execution
 * 3. Executing effects immediately
 *
 * ## Purpose
 * onAction hooks handle "in-page actions" like postcode lookups.
 * They run on POST requests BEFORE block evaluation, allowing effects
 * to set answers that blocks then display.
 *
 * ## Execution Pattern
 * 1. Evaluate when predicate
 * 2. If when fails -> return { executed: false }
 * 3. If when passes -> push hook type to scope -> execute effects -> return { executed: true }
 *
 * ## Wiring Pattern
 * - when -> hook (must evaluate before hook)
 * - effects are chained: effect[0] -> effect[1] -> hook
 *
 * ## First-Match Semantics
 * Only the first matching onAction executes (controlled by StepController).
 * This handler just evaluates a single hook; the controller handles iteration.
 *
 * The @hookType scope variable enables EffectHandler to create
 * EffectFunctionContext with the correct hook type for answer source tracking.
 */
export default class ActionHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ActionHookASTNode,
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

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<ActionHookResult> {
    const whenPassed = this.evaluateWhenPredicateSync(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
        },
      }
    }

    // Push hook type onto scope for effect execution
    context.scope.push({ '@hookType': 'action' })

    // Execute effects
    const effectError = this.executeEffectsSync(context, invoker)

    // Pop scope after effects are done
    context.scope.pop()

    if (effectError) {
      return { error: effectError }
    }

    return {
      value: {
        executed: true,
      },
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<ActionHookResult>> {
    const whenPassed = await this.evaluateWhenPredicate(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
        },
      }
    }

    // Push hook type onto scope for effect execution
    context.scope.push({ '@hookType': 'action' })

    // Execute effects
    const effectError = await this.executeEffects(context, invoker)

    // Pop scope after effects are done
    context.scope.pop()

    if (effectError) {
      return { error: effectError }
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
   * Note: when is required for ActionHook (always has a trigger condition)
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
   * Execute effects immediately
   * Returns error if any effect fails
   */
  private async executeEffects(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<ThunkError | undefined> {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return undefined
    }

    // Execute effects sequentially (order matters)
    for (const effect of effects.filter(isASTNode)) {

      const result = await invoker.invoke(effect.id, context)

      if (result.error) {
        return result.error
      }
    }

    return undefined
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

  private executeEffectsSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): ThunkError | undefined {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return undefined
    }

    // Execute effects sequentially (order matters)
    for (const effect of effects.filter(isASTNode)) {
      const result = invoker.invokeSync(effect.id, context)

      if (result.error) {
        return result.error
      }
    }

    return undefined
  }
}
