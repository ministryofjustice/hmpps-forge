import { LogicType } from '@form-engine/form/types/enums'
import { PredicateASTNode } from '@form-engine/core/types/expressions.type'

/**
 * Check if an AST node is a Predicate expression node
 */
export function isPredicateNode(obj: any): obj is PredicateASTNode {
  return (
    obj != null &&
    obj.expressionType != null &&
    Object.values(LogicType).includes(obj.expressionType) &&
    obj.expressionType !== LogicType.CONDITIONAL
  )
}

/**
 * Check if an AST node is a Predicate Test node
 */
export function isPredicateTestNode(obj: any): obj is PredicateASTNode {
  return obj != null && obj.expressionType === LogicType.TEST
}

/**
 * Check if an AST node is a Predicate AND node
 */
export function isPredicateAndNode(obj: any): obj is PredicateASTNode {
  return obj != null && obj.expressionType === LogicType.AND
}

/**
 * Check if an AST node is a Predicate OR node
 */
export function isPredicateOrNode(obj: any): obj is PredicateASTNode {
  return obj != null && obj.expressionType === LogicType.OR
}

/**
 * Check if an AST node is a Predicate XOR node
 */
export function isPredicateXorNode(obj: any): obj is PredicateASTNode {
  return obj != null && obj.expressionType === LogicType.XOR
}

/**
 * Check if an AST node is a Predicate NOT node
 */
export function isPredicateNotNode(obj: any): obj is PredicateASTNode {
  return obj != null && obj.expressionType === LogicType.NOT
}
