import { NodeId } from '@form-engine/core/types/engine.type'
import { AccessTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  CapturedEffect,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import {
  evaluateUntilFirstMatch,
  evaluateUntilFirstMatchSync,
} from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Result of an access transition evaluation
 */
export interface AccessTransitionResult {
  /**
   * Whether the guards passed (access granted)
   */
  passed: boolean

  /**
   * Navigation target if guards failed (from redirect expressions)
   */
  redirect?: string

  /**
   * HTTP status code for error response (e.g., 401, 403, 404)
   * Only present if access transition uses error response instead of redirect
   */
  status?: number

  /**
   * Error message for error response
   * Only present if access transition uses error response instead of redirect
   */
  message?: string

  /**
   * Captured effects to be committed after access lifecycle completes
   * Effects are captured with their evaluated arguments, deferred for later execution
   */
  pendingEffects?: CapturedEffect[]
}

/**
 * Handler for Access Transition nodes
 *
 * Evaluates onAccess transitions by:
 * 1. Capturing effects (analytics, logging, etc.)
 * 2. Evaluating guards predicate
 * 3. If guards match → evaluating redirect expressions for navigation target
 * 4. Returning result with captured effects for LifecycleCoordinator to commit
 *
 * ## Lifecycle Position
 * Access transitions run after onLoad at each hierarchy level:
 * OUTER onLoad → OUTER onAccess → INNER onLoad → INNER onAccess → Step onLoad → Step onAccess
 *
 * ## Guards Semantics (denial conditions, like validation)
 * Guards define denial conditions - when the predicate is true, access is denied:
 * - guards: true → denial condition matched → access denied, evaluate redirect
 * - guards: false (or absent) → no denial → access granted, continue to next level
 *
 * Example: `guards: Data('itemNotFound').match(Condition.Equals(true))`
 * When itemNotFound is true, the guard matches and access is denied.
 *
 * ## Effects
 * Effects are captured and returned for LifecycleCoordinator to commit immediately.
 * They are captured BEFORE guards are evaluated.
 */
export default class AccessTransitionHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: AccessTransitionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { effects, guards, redirect, message } = this.node.properties

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

    // Check guards
    if (isASTNode(guards)) {
      const handler = deps.thunkHandlerRegistry.get(guards.id)
      if (handler?.isAsync ?? true) {
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
    // Capture effects first (logging, analytics, etc.)
    const capturedEffects = this.captureEffectsSync(context, invoker)

    // Evaluate guards predicate (true = denial condition matched, like validation)
    const guardsMatched = this.evaluateGuardsPredicateSync(context, invoker)

    if (!guardsMatched) {
      return {
        value: {
          passed: true,
          pendingEffects: capturedEffects,
        },
      }
    }

    // Guards failed - check if this is an error response or redirect
    const { status } = this.node.properties

    if (status !== undefined) {
      // Error response - evaluate message and return status/message
      const messageResult = this.evaluateMessageSync(context, invoker)

      return {
        value: {
          passed: false,
          status,
          message: messageResult,
          pendingEffects: capturedEffects,
        },
      }
    }

    // Redirect-based - evaluate redirect to get navigation target
    const redirectResult = this.evaluateRedirectSync(context, invoker)

    return {
      value: {
        passed: false,
        redirect: redirectResult,
        pendingEffects: capturedEffects,
      },
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<AccessTransitionResult>> {
    // Capture effects first (logging, analytics, etc.)
    const capturedEffects = await this.captureEffects(context, invoker)

    // Evaluate guards predicate (true = denial condition matched, like validation)
    const guardsMatched = await this.evaluateGuardsPredicate(context, invoker)

    if (!guardsMatched) {
      return {
        value: {
          passed: true,
          pendingEffects: capturedEffects,
        },
      }
    }

    // Guards failed - check if this is an error response or redirect
    const { status } = this.node.properties

    if (status !== undefined) {
      // Error response - evaluate message and return status/message
      const message = await this.evaluateMessage(context, invoker)

      return {
        value: {
          passed: false,
          status,
          message,
          pendingEffects: capturedEffects,
        },
      }
    }

    // Redirect-based - evaluate redirect to get navigation target
    const redirect = await this.evaluateRedirect(context, invoker)

    return {
      value: {
        passed: false,
        redirect,
        pendingEffects: capturedEffects,
      },
    }
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
   * Capture effects by invoking their handlers
   *
   * Invokes EffectHandler for each effect to get CapturedEffect.
   * Returns captured effects for LifecycleCoordinator to commit.
   */
  private async captureEffects(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<CapturedEffect[]> {
    const effects = this.node.properties.effects as FunctionASTNode[] | undefined

    if (!effects || !Array.isArray(effects) || effects.length === 0) {
      return []
    }

    const effectNodes = effects.filter(isASTNode)
    const results = await Promise.all(effectNodes.map(effect => invoker.invoke<CapturedEffect>(effect.id, context)))

    return results.filter(result => !result.error && result.value).map(result => result.value!)
  }

  /**
   * Evaluate redirect expressions to determine navigation target
   * Returns the first matching redirect path
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

  private captureEffectsSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): CapturedEffect[] {
    const effects = this.node.properties.effects as FunctionASTNode[] | undefined

    if (!effects || !Array.isArray(effects) || effects.length === 0) {
      return []
    }

    return effects
      .filter(isASTNode)
      .map(effect => invoker.invokeSync<CapturedEffect>(effect.id, context))
      .filter(result => !result.error && result.value)
      .map(result => result.value!)
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
