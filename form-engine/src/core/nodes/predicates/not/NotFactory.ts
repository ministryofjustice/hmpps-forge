import { ASTNodeType } from '@form-engine/core/types/enums'
import { PredicateType } from '@form-engine/form/types/enums'
import { PredicateNotExpr } from '@form-engine/form/types/expressions.type'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { NotPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * NotFactory: Creates Not predicate AST nodes
 *
 * Not predicates negate a single operand.
 */
export default class NotFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform NOT predicate: Single operand negation
   */
  create(json: PredicateNotExpr): NotPredicateASTNode {
    if (!json.operand) {
      throw new InvalidNodeError({
        message: 'Not predicate requires an operand',
        node: json,
        expected: 'operand property',
        actual: 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.NOT,
      properties: {
        operand: this.nodeFactory.createNode(json.operand),
      },
      raw: json,
    }
  }
}
