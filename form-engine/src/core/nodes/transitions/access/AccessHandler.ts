import { NodeId } from '@form-engine/core/types/engine.type'
import { AccessTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
  ThunkError,
} from '@form-engine/core/compilation/thunks/types'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { evaluateNextOutcomes, OutcomeEvaluationResult } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluateNextOutcomesSync } from '@form-engine/core/utils/thunkEvaluatorsSync'

/**
 * Result of an access transition evaluation
 */
export interface AccessTransitionResult {
  /**
   * Whether the transition executed (when condition was true or absent)
   */
  executed: boolean

  /**
   * The outcome of the transition:
   * - 'continue': Transition completed, proceed to next transition
   * - 'redirect': Halt and redirect to another page
   * - 'error': Halt and return HTTP error response
   */
  outcome: 'continue' | 'redirect' | 'error'

  /**
   * Navigation target (only present when outcome is 'redirect')
   */
  redirect?: string

  /**
   * HTTP status code for error response (only present when outcome is 'error')
   */
  status?: number

  /**
   * Error message for error response (only present when outcome is 'error')
   */
  message?: string
}

/**
 * Handler for Access Transition nodes
 *
 * Evaluates onAccess transitions by:
 * 1. Evaluating `when` condition (if present)
 * 2. If `when` is false → skip transition (continue to next)
 * 3. If `when` is true (or absent) → execute effects
 * 4. Evaluate next outcomes (redirect/throwError) with first-match semantics
 * 5. Return appropriate result based on first matching outcome
 *
 * ## Outcome Evaluation
 * The `next` array contains redirect and throwError outcomes.
 * Outcomes are evaluated in order until one matches (when condition is true or absent).
 * First match wins and determines the transition result.
 *
 * ## Lifecycle Position
 * Access transitions run at each hierarchy level:
 * OUTER onAccess → INNER onAccess → Step onAccess
 *
 * ## Effects
 * Effects are executed AFTER the `when` condition is evaluated (only if when is true).
 * The @transitionType scope variable enables EffectHandler to create
 * EffectFunctionContext with the correct transition type for answer source tracking.
 */
export default class AccessHandler implements ThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: AccessTransitionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { effects, when, next } = this.node.properties

    // Check when condition
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

    // Check next outcomes
    if (next && Array.isArray(next)) {
      const hasAsyncOutcome = next.filter(isASTNode).some(node => {
        const handler = deps.thunkHandlerRegistry.get(node.id)
        return handler?.isAsync ?? true
      })
      if (hasAsyncOutcome) {
        this.isAsync = true
        return
      }
    }

    this.isAsync = false
  }

  evaluateSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): HandlerResult<AccessTransitionResult> {
    // Step 1: Evaluate `when` condition
    const shouldExecute = this.evaluateWhenConditionSync(context, invoker)

    if (!shouldExecute) {
      // Transition skipped - continue to next transition
      return {
        value: {
          executed: false,
          outcome: 'continue',
        },
      }
    }

    // Step 2: Push transition type onto scope and execute effects
    context.scope.push({ '@transitionType': 'access' })
    const effectError = this.executeEffectsSync(context, invoker)
    context.scope.pop()

    if (effectError) {
      return { error: effectError }
    }

    // Step 3: Evaluate next outcomes (first-match semantics)
    const outcomeResult = this.evaluateOutcomesSync(context, invoker)

    if (outcomeResult.type === 'redirect') {
      return {
        value: {
          executed: true,
          outcome: 'redirect',
          redirect: outcomeResult.value,
        },
      }
    }

    if (outcomeResult.type === 'error') {
      return {
        value: {
          executed: true,
          outcome: 'error',
          status: outcomeResult.value.status,
          message: outcomeResult.value.message,
        },
      }
    }

    // Step 4: No outcome matched - continue to next transition
    return {
      value: {
        executed: true,
        outcome: 'continue',
      },
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<AccessTransitionResult>> {
    // Step 1: Evaluate `when` condition
    const shouldExecute = await this.evaluateWhenCondition(context, invoker)

    if (!shouldExecute) {
      // Transition skipped - continue to next transition
      return {
        value: {
          executed: false,
          outcome: 'continue',
        },
      }
    }

    // Step 2: Push transition type onto scope and execute effects
    context.scope.push({ '@transitionType': 'access' })
    const effectError = await this.executeEffects(context, invoker)
    context.scope.pop()

    if (effectError) {
      return { error: effectError }
    }

    // Step 3: Evaluate next outcomes (first-match semantics)
    const outcomeResult = await this.evaluateOutcomes(context, invoker)

    if (outcomeResult.type === 'redirect') {
      return {
        value: {
          executed: true,
          outcome: 'redirect',
          redirect: outcomeResult.value,
        },
      }
    }

    if (outcomeResult.type === 'error') {
      return {
        value: {
          executed: true,
          outcome: 'error',
          status: outcomeResult.value.status,
          message: outcomeResult.value.message,
        },
      }
    }

    // Step 4: No outcome matched - continue to next transition
    return {
      value: {
        executed: true,
        outcome: 'continue',
      },
    }
  }

  /**
   * Evaluate the `when` condition
   * Returns true if condition passes or doesn't exist (execute by default)
   */
  private async evaluateWhenCondition(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<boolean> {
    const when = this.node.properties.when

    // No condition - always execute
    if (!isASTNode(when)) {
      return true
    }

    const result = await invoker.invoke(when.id, context)

    // On error, skip this transition (fail safe)
    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  /**
   * Execute effects (data loading, analytics, logging, etc.)
   * Returns error if any effect fails
   */
  private async executeEffects(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<ThunkError | undefined> {
    const effects = this.node.properties.effects as FunctionASTNode[] | undefined

    if (!effects || !Array.isArray(effects) || effects.length === 0) {
      return undefined
    }

    // Execute effects sequentially (order matters)
    for (const effect of effects.filter(isASTNode)) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke(effect.id, context)

      if (result.error) {
        return result.error
      }
    }

    return undefined
  }

  /**
   * Evaluate next outcomes to determine transition result
   * Returns the first matching outcome (redirect or error), or 'none' if no match
   */
  private async evaluateOutcomes(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<OutcomeEvaluationResult> {
    const next = this.node.properties.next

    if (!next || !Array.isArray(next)) {
      return { type: 'none' }
    }

    return evaluateNextOutcomes(next, context, invoker)
  }

  // Sync versions of private methods

  private evaluateWhenConditionSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): boolean {
    const when = this.node.properties.when

    // No condition - always execute
    if (!isASTNode(when)) {
      return true
    }

    const result = invoker.invokeSync(when.id, context)

    // On error, skip this transition (fail safe)
    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  private executeEffectsSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): ThunkError | undefined {
    const effects = this.node.properties.effects as FunctionASTNode[] | undefined

    if (!effects || !Array.isArray(effects) || effects.length === 0) {
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

  private evaluateOutcomesSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): OutcomeEvaluationResult {
    const next = this.node.properties.next

    if (!next || !Array.isArray(next)) {
      return { type: 'none' }
    }

    return evaluateNextOutcomesSync(next, context, invoker)
  }
}
