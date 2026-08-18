import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from './enums'
import { ExpressionASTNode, ReferenceASTNode } from './expressions.type'

function isExpressionNode(obj: any): obj is ExpressionASTNode {
  return obj != null && obj.type === ASTNodeType.EXPRESSION
}

/**
 * Check if an AST node is a Reference Expression node
 */
export function isReferenceExprNode(obj: any): obj is ReferenceASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.REFERENCE
}
