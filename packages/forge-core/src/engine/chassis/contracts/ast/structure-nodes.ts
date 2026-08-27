import { FieldBlockASTNode } from './structures.type'
import { ComponentCallType } from '../../../../authoring/types/enums'

export function isFieldBlockStructNode(obj: unknown): obj is FieldBlockASTNode {
  return obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    'kind' in obj &&
    obj.kind === ComponentCallType.FIELD
}
