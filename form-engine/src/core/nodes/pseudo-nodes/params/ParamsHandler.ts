import { NodeId } from '@form-engine/core/types/engine.type'
import { ParamsPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '@form-engine/core/compilation/thunks/types'
import { isSafePropertyKey } from '@form-engine/core/utils/propertyAccess'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
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
export default class ParamsHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: ParamsPseudoNode,
  ) {}

  computeIsAsync(): void {
    this.isAsync = false
  }

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    return this.evaluateSync(context)
  }

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
