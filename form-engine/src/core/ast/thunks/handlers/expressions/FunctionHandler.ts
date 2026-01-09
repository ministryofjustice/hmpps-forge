import { NodeId } from '@form-engine/core/types/engine.type'
import { FunctionASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkLookupError from '@form-engine/errors/ThunkLookupError'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import {
  evaluatePropertyValue,
  evaluatePropertyValueSync,
} from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { FunctionType } from '@form-engine/form/types/enums'

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
 *
 * Synchronous when function and all arguments are sync.
 * Asynchronous when function or any argument is async.
 */
export default class FunctionHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: FunctionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const functionName = this.node.properties.name
    const rawArguments = this.node.properties.arguments

    // Check if function itself is async
    const functionEntry = deps.functionRegistry.get(functionName)
    const functionIsAsync = functionEntry?.isAsync ?? true

    // Check if any argument is async
    const anyArgIsAsync = rawArguments.some(arg => {
      if (isASTNode(arg)) {
        const handler = deps.thunkHandlerRegistry.get(arg.id)

        return handler?.isAsync ?? true
      }

      return false
    })

    // Async if function is async OR any argument is async
    this.isAsync = functionIsAsync || anyArgIsAsync
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
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
    const evaluatedArguments = rawArguments.map(arg => evaluatePropertyValueSync(arg, context, invoker))

    // Call the function - generators don't receive a first argument from scope
    try {
      const result = this.invokeFunction(functionEntry.evaluate, evaluatedArguments, context)

      return { value: result }
    } catch (cause) {
      const wrappedCause = cause instanceof Error ? cause : new Error(String(cause))
      const error = ThunkEvaluationError.failed(this.nodeId, wrappedCause, `FunctionHandler:${functionName}`)

      return { error: error.toThunkError() }
    }
  }

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
    const evaluatedArguments = await Promise.all(rawArguments.map(arg => evaluatePropertyValue(arg, context, invoker)))

    // Call the function - generators don't receive a first argument from scope
    try {
      const result = this.invokeFunction(functionEntry.evaluate, evaluatedArguments, context)

      return { value: result }
    } catch (cause) {
      const wrappedCause = cause instanceof Error ? cause : new Error(String(cause))
      const error = ThunkEvaluationError.failed(this.nodeId, wrappedCause, `FunctionHandler:${functionName}`)

      return { error: error.toThunkError() }
    }
  }

  /**
   * Invoke the function with the appropriate arguments based on function type.
   *
   * - Generators: Called with only the evaluated arguments (no value from scope)
   * - Conditions/Transformers/Effects: Called with @value from scope as first argument
   */
  private invokeFunction(
    evaluate: (...args: any[]) => any,
    evaluatedArguments: any[],
    context: ThunkEvaluationContext,
  ): any {
    if (this.node.expressionType === FunctionType.GENERATOR) {
      return evaluate(...evaluatedArguments)
    }

    const firstArgument = this.getFirstArgument(context)

    return evaluate(firstArgument, ...evaluatedArguments)
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
