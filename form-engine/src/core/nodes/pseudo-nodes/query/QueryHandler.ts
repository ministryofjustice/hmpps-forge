import { NodeId } from '@form-engine/core/types/engine.type'
import { QueryPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { SyncThunkHandler, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for QUERY pseudo nodes
 *
 * Returns URL query parameter values from context.query.
 * No parsing or transformation is applied.
 *
 * Returns the complete value (string | string[] | undefined) for the parameter.
 * Nested property access is handled by Reference expression handlers.
 */
export default class QueryHandler implements SyncThunkHandler {
  readonly isAsync = false as const

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: QueryPseudoNode,
  ) {}

  evaluateSync(context: ThunkEvaluationContext): HandlerResult {
    const { paramName } = this.pseudoNode.properties

    // Validate parameter name is safe before using as property key
    if (!isSafePropertyKey(paramName)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, paramName, PseudoNodeType.QUERY)

      return { error: error.toThunkError() }
    }

    // Read query parameter value from context - direct return, no Promise!
    return { value: context.request.query[paramName] }
  }
}
