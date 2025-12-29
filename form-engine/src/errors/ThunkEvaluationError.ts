import { NodeId } from '@form-engine/core/types/engine.type'
import ThunkBaseError from './ThunkBaseError'

export default class ThunkEvaluationError extends ThunkBaseError {
  static failed(nodeId: NodeId, cause: Error, handlerType?: string): ThunkEvaluationError {
    const message = handlerType
      ? `Handler "${handlerType}" evaluation failed for node "${nodeId}": ${cause.message}`
      : `Handler evaluation failed for node "${nodeId}": ${cause.message}`

    return new ThunkEvaluationError('EVALUATION_FAILED', nodeId, message, {
      'Handler Type': handlerType,
      Cause: cause.message,
    })
  }

  static maxRetriesExceeded(nodeId: NodeId, retryCount: number, maxRetries: number): ThunkEvaluationError {
    return new ThunkEvaluationError(
      'EVALUATION_FAILED',
      nodeId,
      `Node "${nodeId}" exceeded maximum retries (${maxRetries}). This likely indicates an infinite invalidation loop.`,
      {
        'Retry Count': retryCount,
        'Max Retries': maxRetries,
      },
    )
  }

  static expansionLimitExceeded(
    nodeId: NodeId,
    iterations: number,
    maxIterations: number,
    runtimeNodeCount: number,
  ): ThunkEvaluationError {
    return new ThunkEvaluationError(
      'EVALUATION_FAILED',
      nodeId,
      `Runtime node expansion limit exceeded (${iterations}/${maxIterations} iterations, ${runtimeNodeCount} runtime nodes)`,
      {
        Iterations: `${iterations}/${maxIterations}`,
        'Runtime Nodes': runtimeNodeCount,
      },
    )
  }

  static securityViolation(nodeId: NodeId, propertyName: string, pseudoNodeType?: string): ThunkEvaluationError {
    const typeInfo = pseudoNodeType ? ` in ${pseudoNodeType}` : ''

    return new ThunkEvaluationError(
      'SECURITY',
      nodeId,
      `Dangerous property name detected: "${propertyName}"${typeInfo}`,
      {
        Property: propertyName,
        'Pseudo Node Type': pseudoNodeType,
      },
    )
  }

  static incorrectHandler(nodeId: NodeId, handlerName: string): ThunkEvaluationError {
    return new ThunkEvaluationError(
      'INCORRECT_HANDLER',
      nodeId,
      `invokeSync() called on async handler: ${nodeId} (${handlerName}). Use invoke() instead or convert handler to SyncThunkHandler.`,
      {
        Handler: handlerName,
      },
    )
  }
}
