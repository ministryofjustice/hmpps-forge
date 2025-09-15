import { ASTNode } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'

/**
 * Check if a value is an AST node
 */
export function isASTNode(value: any): value is ASTNode {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    Object.values(ASTNodeType).includes(value.type)
  )
}
