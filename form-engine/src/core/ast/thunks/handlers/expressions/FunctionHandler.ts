import { NodeId } from '@form-engine/core/types/engine.type'
import { FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkLookupError from '@form-engine/errors/ThunkLookupError'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for Function expression nodes
 *
 * Evaluates function expressions by:
 * 1. Evaluating all arguments (invoking AST nodes, preserving primitives)
 * 2. Looking up the function implementation from the registry
 * 3. Calling the function with evaluated arguments
 * 4. Returning the result
 *
 * ## Function Types
 * Functions can be:
 * - CONDITION: Returns boolean (used in predicates)
 * - TRANSFORMER: Transforms input value (used in pipelines)
 * - GENERATOR: Generates values (used in defaults)
 * - EFFECT: Side-effecting functions (used in transitions)
 *
 * ## Wiring Pattern
 * Arguments are wired as DATA_FLOW dependencies:
 * - arg[0] → function
 * - arg[1] → function
 * - etc.
 *
 * This ensures all arguments are evaluated before the function executes.
 *
 * ## Registry Lookup
 * Functions are stored in context.functionRegistry by name.
 * If a function is not found, returns undefined.
 */
export default class FunctionHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: FunctionASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const functionName = this.node.properties.name
    const rawArguments = this.node.properties.arguments

    // Look up function in registry
    const functionEntry = context.functionRegistry.get(functionName)

    if (!functionEntry) {
      const availableFunctions = Array.from(context.functionRegistry.getAll().keys())
      const error = ThunkLookupError.function(this.nodeId, functionName, availableFunctions)

      return { error: error.toThunkError() }
    }

    // Evaluate all arguments (AST nodes invoked, primitives passed through)
    const evaluatedArguments = await Promise.all(rawArguments.map(arg => evaluateOperand(arg, context, invoker)))

    // Get the first argument based on function type
    const firstArgument = this.getFirstArgument(context)

    // Call the function with first argument followed by evaluated arguments
    try {
      const result = functionEntry.evaluate(firstArgument, ...evaluatedArguments)

      return { value: result }
    } catch (cause) {
      const wrappedCause = cause instanceof Error ? cause : new Error(String(cause))
      const error = ThunkEvaluationError.failed(this.nodeId, wrappedCause, `FunctionHandler:${functionName}`)

      return { error: error.toThunkError() }
    }
  }

  /**
   * Get the first argument for the function from the current scope
   *
   * Functions expect their first parameter to come from the evaluation context:
   * - Conditions/Transformers: The value being tested/transformed (@value in scope)
   * - Effects: The FormEffectContext for the current transition (@value in scope)
   *
   * The calling handler (TestPredicateHandler, PipelineHandler, TransitionHandler, etc.)
   * is responsible for pushing the appropriate @value onto the scope stack before
   * invoking the function.
   *
   * @param context - Runtime evaluation context
   * @returns The first argument to pass to the function (from scope @value)
   */
  private getFirstArgument(context: ThunkEvaluationContext): unknown {
    if (context.scope.length === 0) {
      return undefined
    }

    const currentScope = context.scope[context.scope.length - 1]

    return currentScope['@value']
  }
}
