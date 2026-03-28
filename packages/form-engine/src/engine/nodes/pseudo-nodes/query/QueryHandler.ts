import { NodeId } from '../../../types/engine.type'
import { QueryPseudoNode, PseudoNodeType } from '../../../types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '../../../utils/propertyAccess'
import ThunkEvaluationError from '../../../errors/ThunkEvaluationError'

/**
 * Handler for QUERY pseudo nodes
 *
 * Returns URL query parameter values from context.query.
 * No parsing or transformation is applied.
 *
 * Returns the complete value (string | string[] | undefined) for the parameter.
 * Nested property access is handled by Reference expression handlers.
 */
export default class QueryHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: QueryPseudoNode,
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
      const error = ThunkEvaluationError.securityViolation(this.nodeId, paramName, PseudoNodeType.QUERY)

      return { error: error.toThunkError() }
    }

    // Read query parameter value from context - direct return, no Promise!
    return { value: context.request.getQuery(paramName) }
  }
}
