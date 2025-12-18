import { NodeId } from '@form-engine/core/types/engine.type'
import { DataPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { SyncThunkHandler, HandlerResult } from '@form-engine/core/ast/thunks/types'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for DATA pseudo nodes
 *
 * Returns external data loaded via onLoad transitions from context.data.
 * The data is stored using the base property name as the key.
 *
 * Returns the complete data object/value (unknown type).
 * Nested property access is handled by Reference expression handlers.
 *
 * Example: If context.data = { user: { profile: { name: 'John' } } }
 * and baseProperty = 'user', this returns the entire user object.
 */
export default class DataHandler implements SyncThunkHandler {
  readonly isAsync = false as const

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: DataPseudoNode,
  ) {}

  evaluateSync(context: ThunkEvaluationContext): HandlerResult {
    const { baseProperty } = this.pseudoNode.properties

    // Validate property name is safe before using as property key
    if (!isSafePropertyKey(baseProperty)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseProperty, PseudoNodeType.DATA)

      return { error: error.toThunkError() }
    }

    // Read external data value from context - direct return, no Promise!
    return { value: context.global.data[baseProperty] }
  }
}
