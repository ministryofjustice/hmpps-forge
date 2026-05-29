import { ASTNodeType } from '../../../../types/enums'
import { ExpressionType } from '../../../../../authoring/types/enums'
import { ConditionalExpr } from '../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '../../../id-generators/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { ConditionalASTNode } from '../../../../types/expressions.type'

/**
 * ConditionalFactory: Creates Conditional AST nodes
 *
 * Conditional expressions implement if-then-else logic, evaluating a predicate
 * to choose between two values. Defaults: thenValue = true, elseValue = false
 */
export default class ConditionalFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Conditional expression: If-then-else logic
   * Evaluates predicate to choose between two values
   */
  create(json: ConditionalExpr): ConditionalASTNode {
    if (!json.predicate) {
      throw new InvalidNodeError({
        message: 'Conditional expression requires a predicate',
        node: json,
        expected: 'predicate property',
        actual: 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.CONDITIONAL,
      properties: {
        predicate: this.nodeFactory.createNode(json.predicate),
        thenValue: json.thenValue !== undefined ? this.nodeFactory.transformValue(json.thenValue) : true,
        elseValue: json.elseValue !== undefined ? this.nodeFactory.transformValue(json.elseValue) : false,
      },
      raw: json,
    }
  }
}
