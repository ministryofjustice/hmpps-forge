import { NodeId } from '@form-engine/core/types/engine.type'
import { PostPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '@form-engine/core/ast/thunks/types'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for POST pseudo nodes
 *
 * Returns raw form submission data from context.post using the base field code.
 * No formatting or transformation is applied - that's handled by format pipelines.
 *
 * Returns the complete value (string | string[] | undefined) for the field.
 * Nested property access is handled by Reference expression handlers.
 */
export default class PostHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: PostPseudoNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    const { baseFieldCode } = this.pseudoNode.properties

    // Validate field code is safe before using as property key
    if (!isSafePropertyKey(baseFieldCode)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseFieldCode, PseudoNodeType.POST)

      return { error: error.toThunkError() }
    }

    // Read raw POST value from context
    return { value: context.request.post[baseFieldCode] }
  }
}
