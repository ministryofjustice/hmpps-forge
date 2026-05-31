import { ASTNodeType } from '../../../../contracts/ast/enums'
import { PredicateType } from '../../../../../authoring/types/enums'
import { PredicateXorExpr } from '../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { PredicateASTNode, XorPredicateASTNode } from '../../../../contracts/ast/predicates.type'

/**
 * XorFactory: Creates Xor predicate AST nodes
 *
 * Xor predicates require exactly one operand to be true.
 */
export default class XorFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform XOR predicate: Multiple operands (exactly one must be true)
   */
  create(json: PredicateXorExpr): XorPredicateASTNode {
    if (!json.operands || !Array.isArray(json.operands) || json.operands.length === 0) {
      throw new InvalidNodeError({
        message: 'Xor predicate requires a non-empty operands array',
        node: json,
        expected: 'operands array with at least one element',
        actual: json.operands ? `array with ${json.operands.length} elements` : 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.XOR,
      properties: {
        operands: json.operands.map((operand: any) => this.nodeFactory.createNode(operand)) as PredicateASTNode[],
      },
      raw: json,
    }
  }
}
