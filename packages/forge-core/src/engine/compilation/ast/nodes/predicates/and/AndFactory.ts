import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { PredicateType } from '../../../../../../authoring/types/enums'
import { PredicateAndExpr } from '../../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { AndPredicateASTNode, PredicateASTNode } from '../../../../../contracts/ast/predicates.type'

/**
 * AndFactory: Creates And predicate AST nodes
 *
 * And predicates require all operands to be true.
 */
export default class AndFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
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
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.AND,
      properties: {
        operands: json.operands.map((operand: unknown) => this.nodeFactory.createNode(operand)) as PredicateASTNode[],
      },
    }
  }
}
