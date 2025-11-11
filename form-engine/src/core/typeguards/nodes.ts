import { ASTNode } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * Check if a value is an AST node
 */
export function isASTNode(value: any): value is ASTNode {
  return value != null &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    Object.values(ASTNodeType).includes(value.type)
}

/**
 * Type guard to check if a node is a pseudo node
 */
export function isPseudoNode(node: ASTNode | PseudoNode): node is PseudoNode {
  return node != null && 'type' in node && Object.values(PseudoNodeType).includes(node.type as PseudoNodeType)
}
