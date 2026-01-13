import { NodeId } from '@form-engine/core/types/engine.type'
import { NextASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluateOperandSync } from '@form-engine/core/utils/thunkEvaluatorsSync'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Handler for Next expression nodes (navigation/routing logic)
 *
 * Evaluates a next expression by:
 * 1. Evaluating the optional 'when' condition
 * 2. If 'when' is truthy (or not present), returning the 'goto' destination
 * 3. If 'when' is falsy, returning undefined (condition not met)
 *
 * The 'goto' can be:
 * - A string path (returned as-is)
 * - An AST node (evaluated dynamically)
 *
 * Synchronous when when and goto are primitives or sync nodes.
 * Asynchronous when when or goto is an async node.
 */
export default class NextHandler implements ThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: NextASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { when, goto } = this.node.properties

    // Check if when is async
    let whenIsAsync = false

    if (when && isASTNode(when)) {
      const whenHandler = deps.thunkHandlerRegistry.get(when.id)

      whenIsAsync = whenHandler?.isAsync ?? true
    }

    // Check if goto is async
    let gotoIsAsync = false

    if (isASTNode(goto)) {
      const gotoHandler = deps.thunkHandlerRegistry.get(goto.id)

      gotoIsAsync = gotoHandler?.isAsync ?? true
    }

    // Async if when or goto is async
    this.isAsync = whenIsAsync || gotoIsAsync
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const { when, goto } = this.node.properties

    // If there's a 'when' condition, evaluate it first
    if (when) {
      const whenValue = evaluateOperandSync(when, context, invoker)

      // If condition is falsy or failed, this next expression doesn't apply
      if (!whenValue) {
        return { value: undefined }
      }
    }

    // Evaluate the goto destination (may be AST node or string)
    const gotoValue = evaluateOperandSync(goto, context, invoker)

    return { value: gotoValue }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const { when, goto } = this.node.properties

    // If there's a 'when' condition, evaluate it first
    if (when) {
      const whenValue = await evaluateOperand(when, context, invoker)

      // If condition is falsy or failed, this next expression doesn't apply
      if (!whenValue) {
        return { value: undefined }
      }
    }

    // Evaluate the goto destination (may be AST node or string)
    const gotoValue = await evaluateOperand(goto, context, invoker)

    return { value: gotoValue }
  }
}
