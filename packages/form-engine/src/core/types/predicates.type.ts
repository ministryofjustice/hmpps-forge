import { ASTNode } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { PredicateType } from '@form-engine/form/types/enums'

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
    operands: ASTNode[]
  }
}

/**
 * Or Predicate Logic AST node
 */
export interface OrPredicateASTNode extends PredicateASTNode {
  predicateType: PredicateType.OR
  properties: {
    operands: ASTNode[]
  }
}

/**
 * Xor Predicate Logic AST node
 */
export interface XorPredicateASTNode extends PredicateASTNode {
  predicateType: PredicateType.XOR
  properties: {
    operands: ASTNode[]
  }
}
