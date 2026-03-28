import { NodeId } from '@form-engine/core/types/engine.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { MatchASTNode } from '@form-engine/core/types/expressions.type'
import { evaluatePropertyValue } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluatePropertyValueSync } from '@form-engine/core/utils/thunkEvaluatorsSync'

/**
 * Handler for Match expression nodes (switch/case logic)
 *
 * Evaluates a match expression by:
 * 1. Iterating through branches in order
 * 2. Evaluating each branch's predicate
 * 3. Returning the value of the first matching branch
 * 4. Returning the otherwise value if no branch matches
 *
 * Branches are evaluated lazily — only the first matching branch's value is evaluated.
 */
export default class MatchHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: MatchASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { branches, otherwise } = this.node.properties

    let anyAsync = false

    for (const branch of branches) {
      const predicateHandler = deps.thunkHandlerRegistry.get(branch.predicate.id)

      if (predicateHandler?.isAsync ?? true) {
        anyAsync = true
      }

      if (isASTNode(branch.value)) {
        const valueHandler = deps.thunkHandlerRegistry.get(branch.value.id)

        if (valueHandler?.isAsync ?? true) {
          anyAsync = true
        }
      }
    }

    if (otherwise && isASTNode(otherwise)) {
      const otherwiseHandler = deps.thunkHandlerRegistry.get(otherwise.id)

      if (otherwiseHandler?.isAsync ?? true) {
        anyAsync = true
      }
    }

    this.isAsync = anyAsync
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    for (const branch of this.node.properties.branches) {
      const predicateResult = invoker.invokeSync(branch.predicate.id, context)

      if (!predicateResult.error && predicateResult.value) {
        const value = evaluatePropertyValueSync(branch.value, context, invoker)

        return { value }
      }
    }

    if (this.node.properties.otherwise !== undefined) {
      const value = evaluatePropertyValueSync(this.node.properties.otherwise, context, invoker)

      return { value }
    }

    return { value: undefined }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    for (const branch of this.node.properties.branches) {
      // eslint-disable-next-line no-await-in-loop -- branches must be evaluated sequentially (first-match semantics)
      const predicateResult = await invoker.invoke(branch.predicate.id, context)

      if (!predicateResult.error && predicateResult.value) {
        // eslint-disable-next-line no-await-in-loop -- only the matched branch's value is evaluated
        const value = await evaluatePropertyValue(branch.value, context, invoker)

        return { value }
      }
    }

    if (this.node.properties.otherwise !== undefined) {
      const value = await evaluatePropertyValue(this.node.properties.otherwise, context, invoker)

      return { value }
    }

    return { value: undefined }
  }
}
