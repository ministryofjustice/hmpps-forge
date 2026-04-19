import { ExpressionType, FunctionType } from '../../authoring/types/enums'
import { ASTNodeType } from '../types/enums'
import {
  ConditionalASTNode,
  ExpressionASTNode,
  FormatASTNode,
  FunctionASTNode,
  IterateASTNode,
  MatchASTNode,
  PipelineASTNode,
  ReferenceASTNode,
  TieBreakerASTNode,
  ValidationASTNode,
} from '../types/expressions.type'

/**
 * Check if an AST node is any type of Expression node
 */
export function isExpressionNode(obj: any): obj is ExpressionASTNode {
  return obj != null && obj.type === ASTNodeType.EXPRESSION
}

/**
 * Check if an AST node is a Reference Expression node
 */
export function isReferenceExprNode(obj: any): obj is ReferenceASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.REFERENCE
}

/**
 * Check if an AST node is a Format Expression node
 */
export function isFormatExprNode(obj: any): obj is FormatASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.FORMAT
}

/**
 * Check if an AST node is a Pipeline Expression node
 */
export function isPipelineExprNode(obj: any): obj is PipelineASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.PIPELINE
}

/**
 * Check if an AST node is a Validation Expression node
 */
export function isValidationExprNode(obj: any): obj is ValidationASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.VALIDATION
}

/**
 * Check if an AST node is a Tie-breaker Expression node
 */
export function isTieBreakerExprNode(obj: any): obj is TieBreakerASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.TIE_BREAKER
}

/**
 * Check if an AST node is an Iterate Expression node
 */
export function isIterateExprNode(obj: any): obj is IterateASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.ITERATE
}

/**
 * Check if an AST node is a Conditional Expression node
 */
export function isConditionalExprNode(obj: any): obj is ConditionalASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.CONDITIONAL
}

/**
 * Check if an AST node is a Match Expression node
 */
export function isMatchExprNode(obj: any): obj is MatchASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.MATCH
}

/**
 * Check if an AST node is any type of Function Expression node
 */
export function isFunctionExprNode(obj: any): obj is FunctionASTNode {
  return obj != null && obj.expressionType != null && Object.values(FunctionType).includes(obj.expressionType)
}

/**
 * Check if an AST node is an Effect Expression node
 * Effects are function expressions that perform side effects (save data, log, etc.)
 * They are handled separately from other functions to enable deferred execution.
 */
export function isEffectExprNode(obj: any): obj is FunctionASTNode {
  return isFunctionExprNode(obj) && obj.expressionType === FunctionType.EFFECT
}
