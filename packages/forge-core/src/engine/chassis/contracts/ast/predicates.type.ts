import { ASTNode } from './engine.type'
import { ASTNodeType } from './enums'
import { PredicateType } from '../../../../authoring/types/enums'

/**
 * Logic AST node - represents logic/predicate operations
 */
export interface PredicateASTNode extends ASTNode {
  type: ASTNodeType.PREDICATE
  predicateType: PredicateType
}

/**
 * Test Predicate Logic AST node
 */
export interface TestPredicateASTNode extends PredicateASTNode {
  predicateType: PredicateType.TEST
  properties: {
    subject: ASTNode
    condition: ASTNode
    negate: boolean
  }
}

/**
 * Not Predicate Logic AST node
 */
export interface NotPredicateASTNode extends PredicateASTNode {
  predicateType: PredicateType.NOT
  properties: {
    operand: ASTNode
  }
}

/**
 * And Predicate Logic AST node
 */
export interface AndPredicateASTNode extends PredicateASTNode {
  predicateType: PredicateType.AND
  properties: {
    operands: PredicateASTNode[]
  }
}

/**
 * Or Predicate Logic AST node
 */
export interface OrPredicateASTNode extends PredicateASTNode {
  predicateType: PredicateType.OR
  properties: {
    operands: PredicateASTNode[]
  }
}

/**
 * Xor Predicate Logic AST node
 */
export interface XorPredicateASTNode extends PredicateASTNode {
  predicateType: PredicateType.XOR
  properties: {
    operands: PredicateASTNode[]
  }
}
