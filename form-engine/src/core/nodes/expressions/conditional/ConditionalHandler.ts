import { NodeId } from '@form-engine/core/types/engine.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { ConditionalASTNode } from '@form-engine/core/types/expressions.type'
import { evaluatePropertyValue, evaluatePropertyValueSync } from '@form-engine/core/ast/thunks/evaluation'

/**
 * Handler for Conditional expression nodes (if-then-else logic)
 *
 * Evaluates a conditional expression by:
 * 1. Evaluating the predicate to determine truthiness
 * 2. Returning thenValue if predicate is truthy
 * 3. Returning elseValue if predicate is falsy
 *
 * Both thenValue and elseValue can be:
 * - AST nodes (evaluated dynamically)
 * - Primitive values (returned as-is)
 * - Undefined (default if not specified)
 *
 * Synchronous when predicate, thenValue, and elseValue are all sync.
 * Asynchronous when any of them is async.
 */
export default class ConditionalHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ConditionalASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { predicate, thenValue, elseValue } = this.node.properties

    // Check predicate
    const predicateHandler = deps.thunkHandlerRegistry.get(predicate.id)
    const predicateIsAsync = predicateHandler?.isAsync ?? true

    // Check thenValue
    let thenIsAsync = false

    if (isASTNode(thenValue)) {
      const thenHandler = deps.thunkHandlerRegistry.get(thenValue.id)

      thenIsAsync = thenHandler?.isAsync ?? true
    }

    // Check elseValue
    let elseIsAsync = false

    if (elseValue && isASTNode(elseValue)) {
      const elseHandler = deps.thunkHandlerRegistry.get(elseValue.id)

      elseIsAsync = elseHandler?.isAsync ?? true
    }

    // Async if ANY component is async (we don't know which branch will be taken)
    this.isAsync = predicateIsAsync || thenIsAsync || elseIsAsync
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const predicateResult = invoker.invokeSync(this.node.properties.predicate.id, context)

    if (predicateResult.error) {
      return { value: undefined }
    }

    const selectedValue = predicateResult.value ? this.node.properties.thenValue : this.node.properties.elseValue
    const value = evaluatePropertyValueSync(selectedValue, context, invoker)

    return { value }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const predicateResult = await invoker.invoke(this.node.properties.predicate.id, context)

    if (predicateResult.error) {
      return { value: undefined }
    }

    const selectedValue = predicateResult.value ? this.node.properties.thenValue : this.node.properties.elseValue

    const value = await evaluatePropertyValue(selectedValue, context, invoker)

    return { value }
  }
}
