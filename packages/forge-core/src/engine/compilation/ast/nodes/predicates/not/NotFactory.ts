import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { PredicateType } from '../../../../../../authoring/types/enums'
import { PredicateNotExpr } from '../../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { NotPredicateASTNode } from '../../../../../contracts/ast/predicates.type'

/**
 * NotFactory: Creates Not predicate AST nodes
 *
 * Not predicates negate a single operand.
 */
export default class NotFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
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
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.NOT,
      properties: {
        operand: this.nodeFactory.createNode(json.operand),
      },
    }
  }
}
