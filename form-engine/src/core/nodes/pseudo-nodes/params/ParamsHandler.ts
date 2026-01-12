import { NodeId } from '@form-engine/core/types/engine.type'
import { ParamsPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { SyncThunkHandler, HandlerResult } from '@form-engine/core/ast/thunks/types'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for PARAMS pseudo nodes
 *
 * Returns URL path parameter values from context.params.
 * No parsing or transformation is applied.
 *
 * Returns the complete value (string | undefined) for the parameter.
 * Nested property access is handled by Reference expression handlers.
 */
export default class ParamsHandler implements SyncThunkHandler {
  readonly isAsync = false as const

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: ParamsPseudoNode,
  ) {}

  evaluateSync(context: ThunkEvaluationContext): HandlerResult {
    const { paramName } = this.pseudoNode.properties

    // Validate parameter name is safe before using as property key
    if (!isSafePropertyKey(paramName)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, paramName, PseudoNodeType.PARAMS)

      return { error: error.toThunkError() }
    }

    // Read route parameter value from context - direct return, no Promise!
    return { value: context.request.params[paramName] }
  }
}
