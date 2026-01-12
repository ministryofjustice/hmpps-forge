import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { NextASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { NextExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'

/**
 * NextFactory: Creates Next expression AST nodes
 *
 * Next expressions define navigation targets.
 * Contains optional condition and destination path.
 */
export default class NextFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Next expression: Navigation target
   */
  create(json: NextExpr): NextASTNode {
    const properties: { when?: ASTNode; goto: ASTNode | any } = {
      goto: this.nodeFactory.transformValue(json.goto),
    }

    if (json.when) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.NEXT,
      properties,
      raw: json,
    }
  }
}
