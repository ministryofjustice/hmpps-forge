import { NodeId } from '@form-engine/core/types/engine.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { getByPath } from '@form-engine/utils/utils'

/**
 * Handler for references with a base expression
 *
 * Resolves references that have a `base` property by:
 * 1. Evaluating the base expression first
 * 2. Navigating into the result using the path segments
 *
 * This enables patterns like:
 * - Data('items').each(Iterator.Find(...)).path('goals')
 * - Literal(array).each(Iterator.Find(...)).path('property')
 *
 * The base expression can be any ValueExpr (iterate, pipeline, reference, etc.)
 * and the path navigates into its evaluated result.
 *
 * Synchronous when the base expression is sync.
 * Asynchronous when the base expression is async.
 */
export default class BaseReferenceHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ReferenceASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const base = this.node.properties.base

    if (!base) {
      // Should not happen - this handler is only used when base exists
      this.isAsync = false
      return
    }

    // Check if the base expression's handler is async
    const baseHandler = deps.thunkHandlerRegistry.get(base.id)
    this.isAsync = baseHandler?.isAsync ?? true
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const { base, path } = this.node.properties

    if (!base) {
      return { value: undefined }
    }

    // Evaluate the base expression
    const baseResult = invoker.invokeSync(base.id, context)

    if (baseResult.error) {
      return baseResult
    }

    // Navigate into the result using path
    if (path.length === 0) {
      return { value: baseResult.value }
    }

    // Join path segments (they should all be strings at this point)
    const pathString = path.map(String).join('.')

    return { value: getByPath(baseResult.value, pathString) }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const { base, path } = this.node.properties

    if (!base) {
      return { value: undefined }
    }

    // Evaluate the base expression
    const baseResult = await invoker.invoke(base.id, context)

    if (baseResult.error) {
      return baseResult
    }

    // Navigate into the result using path
    if (path.length === 0) {
      return { value: baseResult.value }
    }

    // Join path segments (they should all be strings at this point)
    const pathString = path.map(String).join('.')

    return { value: getByPath(baseResult.value, pathString) }
  }
}
