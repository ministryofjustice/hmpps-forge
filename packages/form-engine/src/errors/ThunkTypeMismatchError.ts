import { NodeId } from '@form-engine/core/types/engine.type'
import ThunkBaseError from './ThunkBaseError'

export default class ThunkTypeMismatchError extends ThunkBaseError {
  static invalidNodeType(nodeId: NodeId, actualType: string, expectedTypes: string[]): ThunkTypeMismatchError {
    return new ThunkTypeMismatchError(
      'TYPE_MISMATCH',
      nodeId,
      `Invalid node type "${actualType}" for node "${nodeId}". Expected one of: ${expectedTypes.join(', ')}`,
      {
        'Actual Type': actualType,
        'Expected Types': expectedTypes.join(', '),
      },
    )
  }

  static value(nodeId: NodeId, expectedType: string, actualType: string): ThunkTypeMismatchError {
    return new ThunkTypeMismatchError(
      'TYPE_MISMATCH',
      nodeId,
      `Type mismatch: expected ${expectedType}, got ${actualType}`,
      {
        Expected: expectedType,
        Actual: actualType,
      },
    )
  }
}
