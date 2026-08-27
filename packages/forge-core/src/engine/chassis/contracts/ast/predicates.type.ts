import { ASTNode, MaterialisedASTNode } from './ast.type'
import { PredicateType } from '../../../../authoring/types/enums'

/**
 * Logic AST node - represents logic/predicate operations
 */
export interface PredicateASTNode extends MaterialisedASTNode {
  kind: PredicateType
}

/**
 * Test Predicate Logic AST node
 */
export interface TestPredicateASTNode extends PredicateASTNode {
  kind: PredicateType.TEST
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
  kind: PredicateType.NOT
  properties: {
    operand: ASTNode
  }
}

/**
 * And Predicate Logic AST node
 */
export interface AndPredicateASTNode extends PredicateASTNode {
  kind: PredicateType.AND
  properties: {
    operands: PredicateASTNode[]
  }
}

/**
 * Or Predicate Logic AST node
 */
export interface OrPredicateASTNode extends PredicateASTNode {
  kind: PredicateType.OR
  properties: {
    operands: PredicateASTNode[]
  }
}

/**
 * Xor Predicate Logic AST node
 */
export interface XorPredicateASTNode extends PredicateASTNode {
  kind: PredicateType.XOR
  properties: {
    operands: PredicateASTNode[]
  }
}
