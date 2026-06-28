import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType } from '../../../../../../authoring/types/enums'
import { ConditionalExpr } from '../../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { ConditionalASTNode } from '../../../../../contracts/ast/expressions.type'

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
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.CONDITIONAL,
      properties: {
        predicate: this.nodeFactory.createChildNode(json.predicate, 'predicate'),
        thenValue: json.thenValue !== undefined ? this.nodeFactory.transformChild(json.thenValue, 'thenValue') : true,
        elseValue: json.elseValue !== undefined ? this.nodeFactory.transformChild(json.elseValue, 'elseValue') : false,
      },
    }
  }
}
