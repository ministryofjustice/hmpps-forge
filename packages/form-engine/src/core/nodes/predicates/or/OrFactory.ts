import { ASTNodeType } from '@form-engine/core/types/enums'
import { PredicateType } from '@form-engine/form/types/enums'
import { PredicateOrExpr } from '@form-engine/form/types/expressions.type'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { OrPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * OrFactory: Creates Or predicate AST nodes
 *
 * Or predicates require at least one operand to be true.
 */
export default class OrFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform OR predicate: Multiple operands (at least one must be true)
   */
  create(json: PredicateOrExpr): OrPredicateASTNode {
    if (!json.operands || !Array.isArray(json.operands) || json.operands.length === 0) {
      throw new InvalidNodeError({
        message: 'Or predicate requires a non-empty operands array',
        node: json,
        expected: 'operands array with at least one element',
        actual: json.operands ? `array with ${json.operands.length} elements` : 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.OR,
      properties: {
        operands: json.operands.map((operand: any) => this.nodeFactory.createNode(operand)),
      },
      raw: json,
    }
  }
}
