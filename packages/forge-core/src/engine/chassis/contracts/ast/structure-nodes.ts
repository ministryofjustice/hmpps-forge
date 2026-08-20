import { FieldBlockASTNode } from './structures.type'
import { ASTNodeType } from './enums'
import { BlockType } from '../../../../authoring/types/enums'

export function isFieldBlockStructNode(obj: any): obj is FieldBlockASTNode {
  return obj != null && obj.type === ASTNodeType.BLOCK && obj.blockType === BlockType.FIELD
}
