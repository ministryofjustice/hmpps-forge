import { NodeId } from '@form-engine/core/types/engine.type'
import ThunkBaseError from './ThunkBaseError'

export default class ThunkLookupError extends ThunkBaseError {
  static node(missingNodeId: NodeId, referencingNodeId: NodeId): ThunkLookupError {
    return new ThunkLookupError(
      'LOOKUP_FAILED',
      missingNodeId,
      `Node "${missingNodeId}" not found (referenced by "${referencingNodeId}")`,
      {
        'Missing Node': missingNodeId,
        'Referenced By': referencingNodeId,
      },
    )
  }

  static function(nodeId: NodeId, functionName: string, availableFunctions?: string[]): ThunkLookupError {
    const available = availableFunctions?.length
      ? availableFunctions.slice(0, 10).join(', ') + (availableFunctions.length > 10 ? '...' : '')
      : undefined

    return new ThunkLookupError('LOOKUP_FAILED', nodeId, `Function "${functionName}" not found in registry`, {
      Function: functionName,
      Available: available,
    })
  }
}
