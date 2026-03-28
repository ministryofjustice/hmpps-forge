import { NodeId } from '@form-engine/core/types/engine.type'
import { SubmitTransitionASTNode } from '@form-engine/core/types/expressions.type'
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
 * Result of a submit transition evaluation
 */
export interface SubmitTransitionResult {
  /**
   * Whether the transition was executed (when/guards passed)
   */
  executed: boolean

  /**
   * Whether validation was performed
   */
  validated: boolean

  /**
   * Whether validation passed (only meaningful if validated=true)
   */
  isValid?: boolean

  /**
   * The outcome of the transition:
   * - 'continue': Transition completed, proceed to render
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
 * Handler for Submit Transition nodes
 *
 * Evaluates onSubmission transitions by:
 * 1. Checking when/guards predicates
 * 2. Reading stored step validation state from context if validate=true
 * 3. Pushing @transitionType: 'submit' onto scope for effect execution
 * 4. Executing onAlways effects first when validate=true
 * 5. Choosing onValid or onInvalid based on the stored validation result
 * 6. Evaluating next outcomes for navigation/errors after effects have run
 *
 * ## Key Design: Effects Execute Before Next
 * Effects are executed BEFORE next expressions are evaluated. This ensures
 * that data set by effects (e.g., goalUuid) is available when evaluating
 * next expressions that reference that data (e.g., Format('goal/%1', Data('goalUuid'))).
 *
 * ## Outcome Evaluation
 * The `next` array in each branch contains redirect and throwError outcomes.
 * Outcomes are evaluated in order until one matches (when condition is true or absent).
 * First match wins and determines the transition result.
 *
 * ## Execution Pattern
 * - when → transition (must evaluate before transition)
 * - guards → transition (must evaluate before transition)
 * - validation state is prepared earlier in the request lifecycle
 * - effects are executed sequentially within each branch
 * - next expressions are evaluated after effects complete
 *
 * ## Validation Logic
 * If validate=true:
 * - Reads step validation state prepared earlier in the request lifecycle
 * - If all validations pass: executes onValid branch
 * - If any validation fails: executes onInvalid branch
 * - Always executes onAlways branch effects first
 *
 * If validate=false:
 * - Skips validation
 * - Executes onAlways branch
 *
 * The @transitionType scope variable enables EffectHandler to create
 * EffectFunctionContext with the correct transition type for answer source tracking.
 */
export default class SubmitHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: SubmitTransitionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { when, guards, onAlways, onValid, onInvalid } = this.node.properties

    // Check when predicate
    if (isASTNode(when)) {
      const handler = deps.thunkHandlerRegistry.get(when.id)
      if (handler?.isAsync ?? true) {
        this.isAsync = true
        return
      }
    }

    // Check guards predicate
    if (isASTNode(guards)) {
      const handler = deps.thunkHandlerRegistry.get(guards.id)
      if (handler?.isAsync ?? true) {
        this.isAsync = true
        return
      }
    }

    // Check branches
    const branches = [onAlways, onValid, onInvalid].filter(Boolean)

    for (const branch of branches) {
      // Check effects in branch
      if (branch?.effects && Array.isArray(branch.effects)) {
        const hasAsyncEffect = branch.effects.filter(isASTNode).some(effect => {
          const handler = deps.thunkHandlerRegistry.get(effect.id)
          return handler?.isAsync ?? true
        })
        if (hasAsyncEffect) {
          this.isAsync = true
          return
        }
      }

      // Check next outcomes in branch
      if (branch?.next && Array.isArray(branch.next)) {
        const hasAsyncNext = branch.next.filter(isASTNode).some(node => {
          const handler = deps.thunkHandlerRegistry.get(node.id)
          return handler?.isAsync ?? true
        })
        if (hasAsyncNext) {
          this.isAsync = true
          return
        }
      }
    }

    this.isAsync = false
  }

  evaluateSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): HandlerResult<SubmitTransitionResult> {
    // Check when predicate
    const whenPassed = this.evaluateWhenPredicateSync(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Check guards predicate
    const guardsPassed = this.evaluateGuardsPredicateSync(context, invoker)

    if (!guardsPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Determine validation state
    const validate = this.node.properties.validate
    let isValid: boolean | undefined

    if (validate === true) {
      const validation = this.getStoredValidationState(context)

      if ('error' in validation) {
        return { error: validation.error }
      }

      isValid = validation.isValid
    }

    // Push transition type onto scope for effect execution
    context.scope.push({ '@transitionType': 'submit' })

    // Execute effects and evaluate next from appropriate branch
    let outcomeResult: OutcomeEvaluationResult = { type: 'none' }

    if (validate === true) {
      // Execute onAlways effects first
      const alwaysError = this.executeEffectsSync(this.node.properties.onAlways?.effects, context, invoker)

      if (alwaysError) {
        context.scope.pop()

        return { error: alwaysError }
      }

      if (isValid) {
        const result = this.executeBranchSync(this.node.properties.onValid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      } else {
        const result = this.executeBranchSync(this.node.properties.onInvalid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      }
    } else {
      // Skip validation transition
      const result = this.executeBranchSync(this.node.properties.onAlways, context, invoker)

      if (result.error) {
        context.scope.pop()

        return { error: result.error }
      }

      outcomeResult = result.outcome
    }

    // Pop scope after effects are done
    context.scope.pop()

    return {
      value: this.buildResult(validate === true, isValid, outcomeResult),
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<SubmitTransitionResult>> {
    // Check when predicate
    const whenPassed = await this.evaluateWhenPredicate(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Check guards predicate
    const guardsPassed = await this.evaluateGuardsPredicate(context, invoker)

    if (!guardsPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Determine validation state
    const validate = this.node.properties.validate
    let isValid: boolean | undefined

    if (validate === true) {
      const validation = this.getStoredValidationState(context)

      if ('error' in validation) {
        return { error: validation.error }
      }

      isValid = validation.isValid
    }

    // Push transition type onto scope for effect execution
    context.scope.push({ '@transitionType': 'submit' })

    // Execute effects and evaluate next from appropriate branch
    let outcomeResult: OutcomeEvaluationResult = { type: 'none' }

    if (validate === true) {
      // Execute onAlways effects first
      const alwaysError = await this.executeEffects(this.node.properties.onAlways?.effects, context, invoker)

      if (alwaysError) {
        context.scope.pop()

        return { error: alwaysError }
      }

      if (isValid) {
        const result = await this.executeBranch(this.node.properties.onValid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      } else {
        const result = await this.executeBranch(this.node.properties.onInvalid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      }
    } else {
      // Skip validation transition
      const result = await this.executeBranch(this.node.properties.onAlways, context, invoker)

      if (result.error) {
        context.scope.pop()

        return { error: result.error }
      }

      outcomeResult = result.outcome
    }

    // Pop scope after effects are done
    context.scope.pop()

    return {
      value: this.buildResult(validate === true, isValid, outcomeResult),
    }
  }

  /**
   * Build the final result from outcome evaluation
   */
  private buildResult(
    validated: boolean,
    isValid: boolean | undefined,
    outcomeResult: OutcomeEvaluationResult,
  ): SubmitTransitionResult {
    const baseResult = {
      executed: true,
      validated,
      isValid,
    }

    if (outcomeResult.type === 'redirect') {
      return {
        ...baseResult,
        outcome: 'redirect' as const,
        redirect: outcomeResult.value,
      }
    }

    if (outcomeResult.type === 'error') {
      return {
        ...baseResult,
        outcome: 'error' as const,
        status: outcomeResult.value.status,
        message: outcomeResult.value.message,
      }
    }

    return {
      ...baseResult,
      outcome: 'continue' as const,
    }
  }

  /**
   * Evaluate the when predicate
   * Returns true if predicate passes or doesn't exist
   */
  private async evaluateWhenPredicate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<boolean> {
    const when = this.node.properties.when

    if (!isASTNode(when)) {
      return true
    }

    const result = await invoker.invoke(when.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  /**
   * Evaluate the guards predicate
   * Returns true if predicate passes or doesn't exist
   */
  private async evaluateGuardsPredicate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<boolean> {
    const guards = this.node.properties.guards

    if (!isASTNode(guards)) {
      return true
    }

    const result = await invoker.invoke(guards.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  /**
   * Read validation state prepared earlier by request orchestration.
   */
  private getStoredValidationState(context: ThunkEvaluationContext): { isValid: boolean } | { error: ThunkError } {
    const validation = context.global.validation

    if (!validation?.validated) {
      return {
        error: {
          type: 'EVALUATION_FAILED',
          nodeId: this.nodeId,
          message: 'Submit validation state missing from evaluation context',
        },
      }
    }

    return { isValid: validation.isValid }
  }

  /**
   * Execute effects immediately
   * Returns error if any effect fails
   */
  private async executeEffects(
    effects: unknown[] | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<ThunkError | undefined> {
    if (!effects) {
      return undefined
    }

    const effectNodes = effects.filter(isASTNode)

    // Execute effects sequentially (order matters)
    for (const effectNode of effectNodes) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke(effectNode.id, context)

      if (result.error) {
        return result.error
      }
    }

    return undefined
  }

  /**
   * Execute effects and evaluate next outcomes from a branch
   *
   * IMPORTANT: Effects are executed FIRST, then outcomes are evaluated.
   * This ensures data set by effects is available when evaluating next expressions.
   */
  private async executeBranch(
    branch: { effects?: unknown[]; next?: unknown[] } | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<{ error?: ThunkError; outcome: OutcomeEvaluationResult }> {
    if (!branch) {
      return { outcome: { type: 'none' } }
    }

    // Execute effects FIRST
    const error = await this.executeEffects(branch.effects, context, invoker)

    if (error) {
      return { error, outcome: { type: 'none' } }
    }

    // THEN evaluate next outcomes (effects have already run, so Data('goalUuid') works)
    const outcome = branch.next ? await evaluateNextOutcomes(branch.next, context, invoker) : { type: 'none' as const }

    return { outcome }
  }

  private evaluateWhenPredicateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): boolean {
    const when = this.node.properties.when

    if (!isASTNode(when)) {
      return true
    }

    const result = invoker.invokeSync(when.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  private evaluateGuardsPredicateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): boolean {
    const guards = this.node.properties.guards

    if (!isASTNode(guards)) {
      return true
    }

    const result = invoker.invokeSync(guards.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  private executeEffectsSync(
    effects: unknown[] | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): ThunkError | undefined {
    if (!effects) {
      return undefined
    }

    const effectNodes = effects.filter(isASTNode)

    // Execute effects sequentially (order matters)
    for (const effectNode of effectNodes) {
      const result = invoker.invokeSync(effectNode.id, context)

      if (result.error) {
        return result.error
      }
    }

    return undefined
  }

  private executeBranchSync(
    branch: { effects?: unknown[]; next?: unknown[] } | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): { error?: ThunkError; outcome: OutcomeEvaluationResult } {
    if (!branch) {
      return { outcome: { type: 'none' } }
    }

    // Execute effects FIRST
    const error = this.executeEffectsSync(branch.effects, context, invoker)

    if (error) {
      return { error, outcome: { type: 'none' } }
    }

    // THEN evaluate next outcomes
    const outcome = branch.next ? evaluateNextOutcomesSync(branch.next, context, invoker) : { type: 'none' as const }

    return { outcome }
  }

}
