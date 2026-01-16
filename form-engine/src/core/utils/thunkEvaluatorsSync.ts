import { NodeId } from '@form-engine/core/types/engine.type'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { RedirectOutcomeResult } from '@form-engine/core/nodes/outcomes/redirect/RedirectOutcomeHandler'
import {
  ThrowErrorOutcomeData,
  ThrowErrorOutcomeResult,
} from '@form-engine/core/nodes/outcomes/throw-error/ThrowErrorOutcomeHandler'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '@form-engine/core/typeguards/outcome-nodes'

/**
 * Result type for operand evaluation with explicit error tracking
 */
export interface OperandEvaluationResultSync {
  value: unknown
  failed: boolean
}

/**
 * Evaluate an operand which may be an AST node or a primitive (sync version)
 *
 * If the operand is an AST node, invokes its handler synchronously and returns the result.
 * If evaluation fails, returns undefined.
 * If the operand is a primitive, returns it as-is.
 *
 * @param operand - The operand to evaluate (AST node or primitive)
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns The evaluated value, or undefined if evaluation failed
 */
export function evaluateOperandSync(
  operand: unknown,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): unknown {
  if (isASTNode(operand)) {
    const result = invoker.invokeSync(operand.id, context)

    if (result.error) {
      return undefined
    }

    return result.value
  }

  return operand
}

/**
 * Evaluate an operand with explicit error tracking (sync version)
 *
 * Similar to evaluateOperandSync but returns a discriminated result object
 * that explicitly indicates whether evaluation failed.
 *
 * @param operand - The operand to evaluate (AST node or primitive)
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns Object with value and failed flag
 */
export function evaluateOperandWithErrorTrackingSync(
  operand: unknown,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): OperandEvaluationResultSync {
  if (isASTNode(operand)) {
    const result = invoker.invokeSync(operand.id, context)

    if (!result || result.error) {
      return { value: undefined, failed: true }
    }

    return { value: result.value, failed: false }
  }

  return { value: operand, failed: false }
}

/**
 * Execute a synchronous operation within a scoped context
 *
 * Pushes scope bindings before execution and pops them after,
 * ensuring proper cleanup even if an error occurs.
 *
 * @param scopeBindings - Key-value pairs to add to scope (e.g., { '@value': currentValue })
 * @param context - The evaluation context
 * @param evaluator - The sync function to execute within scope
 * @returns The result of the evaluator function
 */
export function evaluateWithScopeSync<T>(
  scopeBindings: Record<string, unknown>,
  context: ThunkEvaluationContext,
  evaluator: () => T,
): T {
  context.scope.push(scopeBindings)

  try {
    return evaluator()
  } finally {
    context.scope.pop()
  }
}

/**
 * Recursively evaluate a value synchronously (sync version of evaluatePropertyValue)
 *
 * Handles:
 * - null/undefined: pass through
 * - AST nodes (if registered): invoke synchronously and return result
 * - AST nodes (if NOT registered): filter out (return undefined)
 * - Arrays: recursively evaluate each element, filtering out undefined
 * - Objects: recursively evaluate each property value
 * - Primitives: return as-is
 *
 * Used by structure handlers (Block, Step, Journey) for sync evaluation.
 *
 * @param value - The value to evaluate
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns The evaluated value with all nested AST nodes resolved
 */
export function evaluatePropertyValueSync(
  value: unknown,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): unknown {
  if (value === null || value === undefined) {
    return value
  }

  // AST node handling
  if (isASTNode(value)) {
    // Only evaluate if registered - otherwise filter out
    if (!context.nodeRegistry.has(value.id)) {
      return undefined
    }

    const result = invoker.invokeSync(value.id, context)

    if (result.error) {
      return undefined
    }

    return result.value
  }

  // Array - recursively evaluate each element, filtering out undefined results
  if (Array.isArray(value)) {
    const evaluated = value.map(element => evaluatePropertyValueSync(element, context, invoker))
    return evaluated.filter(item => item !== undefined)
  }

  // Object - recursively evaluate each property
  if (typeof value === 'object') {
    return evaluatePropertyObjectSync(value as Record<string, unknown>, context, invoker)
  }

  // Primitive - return as-is
  return value
}

/**
 * Recursively evaluate an object's property values synchronously
 *
 * @param obj - The object to evaluate
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns Object with all property values evaluated
 */
function evaluatePropertyObjectSync(
  obj: Record<string, unknown>,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  Object.entries(obj).forEach(([key, val]) => {
    result[key] = evaluatePropertyValueSync(val, context, invoker)
  })

  return result
}

/**
 * Synchronous version of evaluateUntilFirstMatch
 */
export function evaluateUntilFirstMatchSync(
  nodeIds: NodeId[],
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
  isMatch: (value: unknown) => boolean = value => value !== undefined,
): unknown {
  for (const nodeId of nodeIds) {
    const result = invoker.invokeSync(nodeId, context)

    if (!result.error && isMatch(result.value)) {
      return result.value
    }
  }

  return undefined
}

/**
 * Result type for outcome evaluation in transitions (sync version)
 *
 * Used by AccessHandler and SubmitHandler to represent the result
 * of evaluating a `next` array of redirect/throwError outcomes.
 */
export type OutcomeEvaluationResultSync =
  | { type: 'redirect'; value: string }
  | { type: 'error'; value: ThrowErrorOutcomeData }
  | { type: 'none' }

/**
 * Evaluate next outcomes to determine transition result (sync version)
 *
 * Evaluates outcomes in order with first-match semantics:
 * - RedirectOutcome: Returns redirect path when `when` matches
 * - ThrowErrorOutcome: Returns error data when `when` matches
 *
 * Returns the first matching outcome (redirect or error), or 'none' if no match.
 *
 * @param nextExpressions - Array of outcome nodes to evaluate
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns The first matching outcome result
 */
export function evaluateNextOutcomesSync(
  nextExpressions: unknown[],
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): OutcomeEvaluationResultSync {
  for (const outcome of nextExpressions.filter(isASTNode)) {
    const result = invoker.invokeSync(outcome.id, context)

    if (result.error) {
      // eslint-disable-next-line no-continue
      continue
    }

    // Check for redirect outcome
    if (isRedirectOutcomeNode(outcome)) {
      const redirectValue = result.value as RedirectOutcomeResult

      if (redirectValue !== undefined) {
        return { type: 'redirect', value: redirectValue }
      }
    }

    // Check for throw error outcome
    if (isThrowErrorOutcomeNode(outcome)) {
      const errorValue = result.value as ThrowErrorOutcomeResult

      if (errorValue !== undefined) {
        return { type: 'error', value: errorValue }
      }
    }
  }

  return { type: 'none' }
}
