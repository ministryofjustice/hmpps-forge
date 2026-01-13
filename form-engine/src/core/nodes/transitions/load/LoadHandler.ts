import { NodeId } from '@form-engine/core/types/engine.type'
import { LoadTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'

/**
 * Result of a load transition evaluation
 */
export interface LoadTransitionResult {
  /**
   * Whether the transition executed successfully
   */
  executed: boolean
}

/**
 * Handler for Load Transition nodes
 *
 * Evaluates onLoad transitions by executing effects immediately.
 * Effects are functions that typically load external data into context.data.
 *
 * ## Execution Pattern
 * 1. Push @transitionType: 'load' onto scope for effect execution
 * 2. Invoke each effect sequentially (effects execute immediately)
 * 3. Pop scope and return success indicator
 *
 * ## Wiring Pattern
 * Effects are wired sequentially in the dependency graph:
 * - effect[0] → effect[1] → effect[2] → transition
 * - Each effect must complete before the next begins
 * - Last effect wires to transition with DATA_FLOW edge
 *
 * The @transitionType scope variable enables EffectHandler to create
 * EffectFunctionContext with the correct transition type for answer source tracking.
 */
export default class LoadHandler implements ThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: LoadTransitionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      this.isAsync = false
      return
    }

    // Check if any effect handler is async
    this.isAsync = effects.some(effect => {
      const handler = deps.thunkHandlerRegistry.get(effect.id)
      return handler?.isAsync ?? true
    })
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<LoadTransitionResult> {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return { value: { executed: true } }
    }

    // Push transition type onto scope for effect execution
    context.scope.push({ '@transitionType': 'load' })

    // Execute effects sequentially (order matters)
    for (const effect of effects) {
      const result = invoker.invokeSync(effect.id, context)

      if (result.error) {
        // Fail-fast: stop on first error, but still pop scope
        context.scope.pop()

        return { error: result.error }
      }
    }

    // Pop scope after effects are done
    context.scope.pop()

    return { value: { executed: true } }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<LoadTransitionResult>> {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return { value: { executed: true } }
    }

    // Push transition type onto scope for effect execution
    context.scope.push({ '@transitionType': 'load' })

    // Execute effects sequentially (order matters)
    for (const effect of effects) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke(effect.id, context)

      if (result.error) {
        // Fail-fast: stop on first error, but still pop scope
        context.scope.pop()

        return { error: result.error }
      }
    }

    // Pop scope after effects are done
    context.scope.pop()

    return { value: { executed: true } }
  }
}
