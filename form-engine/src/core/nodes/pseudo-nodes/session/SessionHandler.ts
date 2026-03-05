import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkHandler, HandlerResult } from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { isSafePropertyKey, safePropertyAccess } from '@form-engine/core/utils/propertyAccess'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import { PseudoNodeType, SessionPseudoNode } from '@form-engine/core/types/pseudoNodes.type'

/**
 * Handler for SESSION pseudo nodes
 *
 * Returns server-side session values from the current request context.
 */
export default class SessionHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: SessionPseudoNode,
  ) {}

  computeIsAsync(): void {
    this.isAsync = false
  }

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    return this.evaluateSync(context)
  }

  evaluateSync(context: ThunkEvaluationContext): HandlerResult {
    const { baseSessionKey } = this.pseudoNode.properties

    if (!isSafePropertyKey(baseSessionKey)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseSessionKey, PseudoNodeType.SESSION)

      return { error: error.toThunkError() }
    }

    return { value: safePropertyAccess(context.request.getSession(), baseSessionKey) }
  }
}
