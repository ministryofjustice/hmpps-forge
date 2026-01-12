import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { FormatASTNode } from '@form-engine/core/types/expressions.type'
import { FormatExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'

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
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
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
