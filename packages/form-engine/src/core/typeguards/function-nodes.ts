import { FunctionType } from '@form-engine/form/types/enums'
import { FunctionASTNode } from '@form-engine/core/types/expressions.type'

/**
 * Check if an AST node is a Function expression node
 */
export function isFunctionNode(obj: any): obj is FunctionASTNode {
  return obj != null && obj.expressionType != null && Object.values(FunctionType).includes(obj.expressionType)
}

/**
 * Check if an AST node is a Condition Function node
 */
export function isConditionFunctionNode(obj: any): obj is FunctionASTNode {
  return obj != null && obj.expressionType === FunctionType.CONDITION
}

/**
 * Check if an AST node is a Transformer Function node
 */
export function isTransformerFunctionNode(obj: any): obj is FunctionASTNode {
  return obj != null && obj.expressionType === FunctionType.TRANSFORMER
}

/**
 * Check if an AST node is an Effect Function node
 */
export function isEffectFunctionNode(obj: any): obj is FunctionASTNode {
  return obj != null && obj.expressionType === FunctionType.EFFECT
}

/**
 * Check if an AST node is a Generator Function node
 */
export function isGeneratorFunctionNode(obj: any): obj is FunctionASTNode {
  return obj != null && obj.expressionType === FunctionType.GENERATOR
}
