import { NodeId } from '../../../types/engine.type'
import { ParamsPseudoNode, PseudoNodeType } from '../../../types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '../../../compilation/thunks/types'
import { isSafePropertyKey } from '../../../utils/propertyAccess'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '../../../errors/ThunkEvaluationError'

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
    return { value: context.request.getParam(paramName) }
  }
}
