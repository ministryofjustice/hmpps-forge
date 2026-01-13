import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'

/**
 * Result type for operand evaluation with explicit error tracking
 */
export interface OperandEvaluationResult {
  value: unknown
  failed: boolean
}

/**
 * Evaluate an operand which may be an AST node or a primitive
 *
 * If the operand is an AST node, invokes its handler and returns the result.
 * If evaluation fails, returns undefined.
 * If the operand is a primitive, returns it as-is.
 *
 * @param operand - The operand to evaluate (AST node or primitive)
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns The evaluated value, or undefined if evaluation failed
 */
export async function evaluateOperand(
  operand: unknown,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): Promise<unknown> {
  if (isASTNode(operand)) {
    const result = await invoker.invoke(operand.id, context)

    if (result.error) {
      return undefined
    }

    return result.value
  }

  return operand
}

/**
 * Evaluate an operand with explicit error tracking
 *
 * Similar to evaluateOperand but returns a discriminated result object
 * that explicitly indicates whether evaluation failed.
 *
 * @param operand - The operand to evaluate (AST node or primitive)
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns Object with value and failed flag
 */
export async function evaluateOperandWithErrorTracking(
  operand: unknown,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): Promise<OperandEvaluationResult> {
  if (isASTNode(operand)) {
    const result = await invoker.invoke(operand.id, context)

    if (!result || result.error) {
      return { value: undefined, failed: true }
    }

    return { value: result.value, failed: false }
  }

  return { value: operand, failed: false }
}

/**
 * Execute an async operation within a scoped context
 *
 * Pushes scope bindings before execution and pops them after,
 * ensuring proper cleanup even if an error occurs.
 *
 * @param scopeBindings - Key-value pairs to add to scope (e.g., { '@value': currentValue })
 * @param context - The evaluation context
 * @param evaluator - The async function to execute within scope
 * @returns The result of the evaluator function
 */
export async function evaluateWithScope<T>(
  scopeBindings: Record<string, unknown>,
  context: ThunkEvaluationContext,
  evaluator: () => Promise<T>,
): Promise<T> {
  context.scope.push(scopeBindings)

  try {
    return await evaluator()
  } finally {
    context.scope.pop()
  }
}

/**
 * Recursively evaluate a value which may contain AST nodes
 *
 * Handles:
 * - null/undefined: pass through
 * - AST nodes (if registered): invoke and return result
 * - AST nodes (if NOT registered): filter out (return undefined)
 * - Arrays: recursively evaluate each element, filtering out undefined
 * - Objects: recursively evaluate each property value
 * - Primitives: return as-is
 *
 * Used by structure handlers (Block, Step, Journey) to evaluate
 * dynamic expressions nested within property objects.
 *
 * @param value - The value to evaluate
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns The evaluated value with all nested AST nodes resolved
 */
export async function evaluatePropertyValue(
  value: unknown,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): Promise<unknown> {
  if (value === null || value === undefined) {
    return value
  }

  // AST node handling
  if (isASTNode(value)) {
    // Only evaluate if registered - otherwise filter out
    if (!context.nodeRegistry.has(value.id)) {
      return undefined
    }

    const result = await invoker.invoke(value.id, context)

    if (result.error) {
      return undefined
    }

    return result.value
  }

  // Array - recursively evaluate each element, filtering out undefined results
  if (Array.isArray(value)) {
    const evaluated = await Promise.all(value.map(element => evaluatePropertyValue(element, context, invoker)))
    return evaluated.filter(item => item !== undefined)
  }

  // Object - recursively evaluate each property
  if (typeof value === 'object') {
    return evaluatePropertyObject(value as Record<string, unknown>, context, invoker)
  }

  // Primitive - return as-is
  return value
}

/**
 * Recursively evaluate an object's property values
 *
 * @param obj - The object to evaluate
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @returns Object with all property values evaluated
 */
async function evaluatePropertyObject(
  obj: Record<string, unknown>,
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}

  await Promise.all(
    Object.entries(obj).map(async ([key, val]) => {
      result[key] = await evaluatePropertyValue(val, context, invoker)
    }),
  )

  return result
}

/**
 * Evaluate nodes sequentially until predicate returns true
 *
 * Evaluates each node in order, stopping when the predicate matches.
 * Useful for finding the first valid redirect, next path, or other
 * conditional navigation target.
 *
 * @param nodeIds - NodeIds to evaluate in order
 * @param context - The evaluation context
 * @param invoker - The thunk invocation adapter
 * @param isMatch - Predicate to determine if value matches (defaults to value !== undefined)
 * @returns The first matching value, or undefined if none match
 */
export async function evaluateUntilFirstMatch(
  nodeIds: NodeId[],
  context: ThunkEvaluationContext,
  invoker: ThunkInvocationAdapter,
  isMatch: (value: unknown) => boolean = value => value !== undefined,
): Promise<unknown> {
  for (const nodeId of nodeIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await invoker.invoke(nodeId, context)

    if (!result.error && isMatch(result.value)) {
      return result.value
    }
  }

  return undefined
}
