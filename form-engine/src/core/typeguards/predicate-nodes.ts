import { PredicateType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  AndPredicateASTNode,
  PredicateASTNode,
  NotPredicateASTNode,
  OrPredicateASTNode,
  TestPredicateASTNode,
  XorPredicateASTNode,
} from '@form-engine/core/types/predicates.type'

/**
 * Check if an AST node is a Predicate node
 */
export function isPredicateNode(obj: any): obj is PredicateASTNode {
  return obj != null && obj.type === ASTNodeType.PREDICATE
}

/**
 * Check if an AST node is a Predicate Test node
 */
export function isTestPredicateNode(obj: any): obj is TestPredicateASTNode {
  return isPredicateNode(obj) && obj.predicateType === PredicateType.TEST
}

/**
 * Check if an AST node is a Predicate AND node
 */
export function isAndPredicateNode(obj: any): obj is AndPredicateASTNode {
  return isPredicateNode(obj) && obj.predicateType === PredicateType.AND
}

/**
 * Check if an AST node is a Predicate OR node
 */
export function isOrPredicateNode(obj: any): obj is OrPredicateASTNode {
  return isPredicateNode(obj) && obj.predicateType === PredicateType.OR
}

/**
 * Check if an AST node is a Predicate XOR node
 */
export function isXorPredicateNode(obj: any): obj is XorPredicateASTNode {
  return isPredicateNode(obj) && obj.predicateType === PredicateType.XOR
}

/**
 * Check if an AST node is a Predicate NOT node
 */
export function isNotPredicateNode(obj: any): obj is NotPredicateASTNode {
  return isPredicateNode(obj) && obj.predicateType === PredicateType.NOT
}
