import { BlockASTNode, FieldBlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType } from '@form-engine/form/types/enums'

// TODO: Go back and rename '___Definition' to '____Struct' as it makes way more sense
export function isJourneyStructNode(obj: any): obj is JourneyASTNode {
  return obj != null && obj.type === ASTNodeType.JOURNEY
}

export function isStepStructNode(obj: any): obj is StepASTNode {
  return obj != null && obj.type === ASTNodeType.STEP
}

export function isBlockStructNode(obj: any): obj is BlockASTNode {
  return obj != null && obj.type === ASTNodeType.BLOCK
}

export function isBasicBlockStructNode(obj: any): obj is BlockASTNode {
  return obj != null && obj.type === ASTNodeType.BLOCK && obj.blockType === BlockType.BASIC
}

export function isFieldBlockStructNode(obj: any): obj is FieldBlockASTNode {
  return obj != null && obj.type === ASTNodeType.BLOCK && obj.blockType === BlockType.FIELD
}
