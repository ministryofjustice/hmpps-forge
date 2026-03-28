import { ASTNodeType } from '@form-engine/core/types/enums'
import { PredicateType } from '@form-engine/form/types/enums'
import { PredicateAndExpr } from '@form-engine/form/types/expressions.type'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { AndPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * AndFactory: Creates And predicate AST nodes
 *
 * And predicates require all operands to be true.
 */
export default class AndFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform AND predicate: Multiple operands (all must be true)
   */
  create(json: PredicateAndExpr): AndPredicateASTNode {
    if (!json.operands || !Array.isArray(json.operands) || json.operands.length === 0) {
      throw new InvalidNodeError({
        message: 'And predicate requires a non-empty operands array',
        node: json,
        expected: 'operands array with at least one element',
        actual: json.operands ? `array with ${json.operands.length} elements` : 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.AND,
      properties: {
        operands: json.operands.map((operand: any) => this.nodeFactory.createNode(operand)),
      },
      raw: json,
    }
  }
}
