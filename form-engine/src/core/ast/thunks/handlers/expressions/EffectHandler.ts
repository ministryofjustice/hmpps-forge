import { NodeId } from '@form-engine/core/types/engine.type'
import { FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult, CapturedEffect } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for Effect expression nodes (FunctionType.EFFECT)
 *
 * Captures effect intent WITHOUT executing the effect:
 * 1. Gets effect name from node properties
 * 2. Evaluates all arguments NOW (to capture state at this moment)
 * 3. Returns CapturedEffect containing intent - does NOT call the effect function
 *
 * The captured effect can later be committed via commitPendingEffects()
 * which will create the EffectFunctionContext and execute the effect.
 *
 * Arguments are evaluated at capture time to preserve the state at the
 * moment the effect was encountered. This ensures effects operate on
 * the values that existed when they were triggered.
 */
export default class EffectHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: FunctionASTNode,
  ) {}

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<CapturedEffect>> {
    const effectName = this.node.properties.name
    const rawArguments = this.node.properties.arguments

    // Evaluate all arguments NOW - capture the values at this moment
    const args = await Promise.all(rawArguments.map(arg => evaluateOperand(arg, context, invoker)))

    // Return captured intent
    return {
      value: {
        effectName,
        args,
        nodeId: this.nodeId,
      },
    }
  }
}
