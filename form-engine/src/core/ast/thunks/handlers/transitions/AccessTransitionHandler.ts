import { NodeId } from '@form-engine/core/types/engine.type'
import { AccessTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult, CapturedEffect } from '@form-engine/core/ast/thunks/types'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateUntilFirstMatch } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

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
   * Captured effects to be committed by LifecycleCoordinator
   * Effects are captured with their evaluated arguments, deferred for commit
   */
  effects: CapturedEffect[]
}

/**
 * Handler for Access Transition nodes
 *
 * Evaluates onAccess transitions by:
 * 1. Capturing effects (analytics, logging, etc.)
 * 2. Evaluating guards predicate
 * 3. If guards fail → evaluating redirect expressions for navigation target
 * 4. Returning result with captured effects for LifecycleCoordinator to commit
 *
 * ## Lifecycle Position
 * Access transitions run after onLoad at each hierarchy level:
 * OUTER onLoad → OUTER onAccess → INNER onLoad → INNER onAccess → Step onLoad → Step onAccess
 *
 * ## Guards Semantics
 * - guards: true (or absent) → access granted, continue to next level
 * - guards: false → access denied, evaluate redirect for navigation target
 *
 * ## Effects
 * Effects are captured and returned for LifecycleCoordinator to commit immediately.
 * They are captured BEFORE guards are evaluated.
 */
export default class AccessTransitionHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: AccessTransitionASTNode,
  ) {}

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<AccessTransitionResult>> {
    // Capture effects first (logging, analytics, etc.)
    const capturedEffects = await this.captureEffects(context, invoker)

    // Evaluate guards predicate
    const guardsPassed = await this.evaluateGuardsPredicate(context, invoker)

    if (guardsPassed) {
      return {
        value: {
          passed: true,
          effects: capturedEffects,
        },
      }
    }

    // Guards failed - evaluate redirect to get navigation target
    const redirect = await this.evaluateRedirect(context, invoker)

    return {
      value: {
        passed: false,
        redirect,
        effects: capturedEffects,
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
}
