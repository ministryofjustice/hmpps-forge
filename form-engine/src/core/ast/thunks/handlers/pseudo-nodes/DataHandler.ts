import { NodeId } from '@form-engine/core/types/engine.type'
import { DataPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '@form-engine/core/ast/thunks/types'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for DATA pseudo nodes
 *
 * Returns external data loaded via onLoad transitions from context.data.
 * The data is stored using the base field code as the key.
 *
 * Returns the complete data object/value (unknown type).
 * Nested property access is handled by Reference expression handlers.
 *
 * Example: If context.data = { user: { profile: { name: 'John' } } }
 * and baseFieldCode = 'user', this returns the entire user object.
 */
export default class DataHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: DataPseudoNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    const { baseFieldCode } = this.pseudoNode.properties

    // Validate field code is safe before using as property key
    if (!isSafePropertyKey(baseFieldCode)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseFieldCode, PseudoNodeType.DATA)

      return { error: error.toThunkError() }
    }

    // Read external data value from context
    return { value: context.global.data[baseFieldCode] }
  }
}
