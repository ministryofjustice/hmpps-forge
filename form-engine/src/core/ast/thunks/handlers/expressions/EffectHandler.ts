import { NodeId } from '@form-engine/core/types/engine.type'
import { FunctionASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
  TransitionType,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import EffectFunctionContext from '@form-engine/core/ast/thunks/EffectFunctionContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import ThunkLookupError from '@form-engine/errors/ThunkLookupError'

/**
 * Handler for Effect expression nodes (FunctionType.EFFECT)
 *
 * Executes effects immediately during transition evaluation:
 * 1. Gets effect name from node properties
 * 2. Evaluates all arguments
 * 3. Looks up effect function from registry
 * 4. Reads @transitionType from scope to create EffectFunctionContext
 * 5. Executes the effect function
 *
 * The transition type is read from scope (@transitionType), which must be
 * pushed by the transition handler before invoking effects. This follows the
 * same pattern as @value for passing contextual data through the scope stack.
 *
 * Synchronous when all arguments are primitives or sync nodes AND the effect is sync.
 * Asynchronous when any argument is an async node OR the effect is async.
 */
export default class EffectHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: FunctionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const rawArguments = this.node.properties.arguments

    // Check if any argument is async
    const hasAsyncArg = rawArguments.some(arg => {
      if (isASTNode(arg)) {
        const handler = deps.thunkHandlerRegistry.get(arg.id)

        return handler?.isAsync ?? true
      }

      return false
    })

    // Effects are typically async (API calls, etc.), so default to true
    // unless we can prove all arguments are sync
    this.isAsync = hasAsyncArg || true
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<void> {
    const effectName = this.node.properties.name
    const rawArguments = this.node.properties.arguments

    // Evaluate all arguments
    const args = rawArguments.map(arg => {
      if (isASTNode(arg)) {
        const result = invoker.invokeSync(arg.id, context)

        return result.error ? undefined : result.value
      }

      return arg
    })

    // Look up effect function
    const effectFn = context.functionRegistry.get(effectName)

    if (!effectFn) {
      const availableFunctions = Array.from(context.functionRegistry.getAll().keys())
      const error = ThunkLookupError.function(this.nodeId, effectName, availableFunctions)

      return { error: error.toThunkError() }
    }

    // Read transition type from scope (pushed by transition handler)
    const currentScope = context.scope[context.scope.length - 1] ?? {}
    const transitionType = (currentScope['@transitionType'] as TransitionType) ?? 'load'
    const effectContext = new EffectFunctionContext(context, transitionType)

    // Execute effect synchronously
    // Note: Most effects are async, so this path is rarely used
    effectFn.evaluate(effectContext, ...args)

    return { value: undefined }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult<void>> {
    const effectName = this.node.properties.name
    const rawArguments = this.node.properties.arguments

    // Evaluate all arguments
    const args = await Promise.all(rawArguments.map(arg => evaluateOperand(arg, context, invoker)))

    // Look up effect function
    const effectFn = context.functionRegistry.get(effectName)

    if (!effectFn) {
      const availableFunctions = Array.from(context.functionRegistry.getAll().keys())
      const error = ThunkLookupError.function(this.nodeId, effectName, availableFunctions)

      return { error: error.toThunkError() }
    }

    // Read transition type from scope (pushed by transition handler)
    const currentScope = context.scope[context.scope.length - 1] ?? {}
    const transitionType = (currentScope['@transitionType'] as TransitionType) ?? 'load'
    const effectContext = new EffectFunctionContext(context, transitionType)

    // Execute effect
    await effectFn.evaluate(effectContext, ...args)

    return { value: undefined }
  }
}
