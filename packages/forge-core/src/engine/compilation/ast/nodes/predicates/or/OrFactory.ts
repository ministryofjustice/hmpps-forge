import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { PredicateType } from '../../../../../../authoring/types/enums'
import { PredicateOrExpr } from '../../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { OrPredicateASTNode, PredicateASTNode } from '../../../../../contracts/ast/predicates.type'

/**
 * OrFactory: Creates Or predicate AST nodes
 *
 * Or predicates require at least one operand to be true.
 */
export default class OrFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
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
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.OR,
      properties: {
        operands: json.operands.map((operand: unknown, index) =>
          this.nodeFactory.createChildNode(operand, 'operands', index),
        ) as PredicateASTNode[],
      },
    }
  }
}
