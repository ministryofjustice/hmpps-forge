import { ExpressionType } from '../../../../authoring/types/enums'
import { ExpressionASTNode, ReferenceASTNode } from './expressions.type'

function isExpressionNode(obj: unknown): obj is ExpressionASTNode {
  return obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    'kind' in obj &&
    typeof obj.kind === 'string' &&
    obj.kind.startsWith('expression.')
}

/**
 * Check if an AST node is a Reference Expression node
 */
export function isReferenceExprNode(obj: unknown): obj is ReferenceASTNode {
  return isExpressionNode(obj) && obj.kind === ExpressionType.REFERENCE
}
