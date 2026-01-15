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
import { evaluateUntilFirstMatch } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluateUntilFirstMatchSync } from '@form-engine/core/utils/thunkEvaluatorsSync'

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
 * 4. Evaluate redirect expressions (if any match → halt and redirect)
 * 5. Check status (if set → halt and return error)
 * 6. Otherwise → continue to next transition
 *
 * ## New Semantics
 * - `when: true` means "execute this transition" (not "deny")
 * - Transitions without redirect/status/message just run effects and continue
 * - First redirect match or status causes halt
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
    const { effects, when, redirect, message } = this.node.properties

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

    // Check redirect expressions
    if (redirect && Array.isArray(redirect)) {
      const hasAsyncRedirect = redirect.filter(isASTNode).some(node => {
        const handler = deps.thunkHandlerRegistry.get(node.id)
        return handler?.isAsync ?? true
      })
      if (hasAsyncRedirect) {
        this.isAsync = true
        return
      }
    }

    // Check message expression
    if (isASTNode(message)) {
      const handler = deps.thunkHandlerRegistry.get(message.id)
      if (handler?.isAsync ?? true) {
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

    // Step 3: Evaluate redirect (if configured and matches)
    const redirectResult = this.evaluateRedirectSync(context, invoker)

    if (redirectResult !== undefined) {
      return {
        value: {
          executed: true,
          outcome: 'redirect',
          redirect: redirectResult,
        },
      }
    }

    // Step 4: Check status (if configured)
    const { status } = this.node.properties

    if (status !== undefined) {
      const messageResult = this.evaluateMessageSync(context, invoker)

      return {
        value: {
          executed: true,
          outcome: 'error',
          status,
          message: messageResult,
        },
      }
    }

    // Step 5: No redirect or error - continue to next transition
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

    // Step 3: Evaluate redirect (if configured and matches)
    const redirectResult = await this.evaluateRedirect(context, invoker)

    if (redirectResult !== undefined) {
      return {
        value: {
          executed: true,
          outcome: 'redirect',
          redirect: redirectResult,
        },
      }
    }

    // Step 4: Check status (if configured)
    const { status } = this.node.properties

    if (status !== undefined) {
      const messageResult = await this.evaluateMessage(context, invoker)

      return {
        value: {
          executed: true,
          outcome: 'error',
          status,
          message: messageResult,
        },
      }
    }

    // Step 5: No redirect or error - continue to next transition
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
   * Evaluate redirect expressions to determine navigation target
   * Returns the first matching redirect path, or undefined if none match
   */
  private async evaluateRedirect(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<string | undefined> {
    const redirect = this.node.properties.redirect

    if (!redirect || !Array.isArray(redirect)) {
      return undefined
    }

    const redirectIds = redirect.filter(isASTNode).map(node => node.id)
    const result = await evaluateUntilFirstMatch(redirectIds, context, invoker)

    return result !== undefined ? String(result) : undefined
  }

  /**
   * Evaluate the message expression for error responses
   * Message can be a static string or a dynamic expression (e.g., Format)
   */
  private async evaluateMessage(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<string | undefined> {
    const { message } = this.node.properties

    if (message === undefined) {
      return undefined
    }

    // Static string - return directly
    if (typeof message === 'string') {
      return message
    }

    // Expression node (e.g., Format) - evaluate and return result
    if (isASTNode(message)) {
      const result = await invoker.invoke<string>(message.id, context)

      return result.error ? undefined : String(result.value)
    }

    return undefined
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

  private evaluateRedirectSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): string | undefined {
    const redirect = this.node.properties.redirect

    if (!redirect || !Array.isArray(redirect)) {
      return undefined
    }

    const redirectIds = redirect.filter(isASTNode).map(node => node.id)
    const result = evaluateUntilFirstMatchSync(redirectIds, context, invoker)

    return result !== undefined ? String(result) : undefined
  }

  private evaluateMessageSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): string | undefined {
    const { message } = this.node.properties

    if (message === undefined) {
      return undefined
    }

    // Static string - return directly
    if (typeof message === 'string') {
      return message
    }

    // Expression node (e.g., Format) - evaluate and return result
    if (isASTNode(message)) {
      const result = invoker.invokeSync<string>(message.id, context)

      return result.error ? undefined : String(result.value)
    }

    return undefined
  }
}
