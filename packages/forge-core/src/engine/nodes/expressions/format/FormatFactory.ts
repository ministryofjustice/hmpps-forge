import { ASTNodeType } from '../../../types/enums'
import { ExpressionType } from '../../../../authoring/types/enums'
import { FormatASTNode } from '../../../types/expressions.type'
import { FormatExpr } from '../../../../authoring/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

/**
 * FormatFactory: Creates Format expression AST nodes
 *
 * Format expressions are string templates with placeholders.
 * Replaces placeholders (%1, %2, etc.) with evaluated argument values.
 * Example: template: 'address_%1_street', arguments: [Item().id]
 */
export default class FormatFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Format expression: String template with placeholders
   */
  create(json: FormatExpr): FormatASTNode {
    const transformedArgs = json.arguments.map((arg: any) => this.nodeFactory.transformValue(arg))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.FORMAT,
      properties: {
        template: json.template,
        arguments: transformedArgs,
      },
      raw: json,
    }
  }
}
