import { ExpressionType, FunctionType, LogicType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  ExpressionASTNode,
  ConditionalASTNode,
  FormatASTNode,
  NextASTNode,
  PipelineASTNode,
  ReferenceASTNode,
  ValidationASTNode,
  PredicateASTNode,
  FunctionASTNode,
  IterateASTNode,
} from '@form-engine/core/types/expressions.type'

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
 * Check if an AST node is a Conditional Expression node
 */
export function isConditionalExprNode(obj: any): obj is ConditionalASTNode {
  return isExpressionNode(obj) && obj.expressionType === LogicType.CONDITIONAL
}

/**
 * Check if an AST node is a Next Expression node
 */
export function isNextExprNode(obj: any): obj is NextASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.NEXT
}

/**
 * Check if an AST node is a Validation Expression node
 */
export function isValidationExprNode(obj: any): obj is ValidationASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.VALIDATION
}

/**
 * Check if an AST node is an Iterate Expression node
 */
export function isIterateExprNode(obj: any): obj is IterateASTNode {
  return isExpressionNode(obj) && obj.expressionType === ExpressionType.ITERATE
}

/**
 * Check if an AST node is any type of Predicate Expression node
 */
export function isPredicateExprNode(obj: any): obj is PredicateASTNode {
  return obj != null &&
    obj.expressionType != null &&
    Object.values(LogicType).includes(obj.expressionType) &&
    obj.expressionType !== LogicType.CONDITIONAL
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
