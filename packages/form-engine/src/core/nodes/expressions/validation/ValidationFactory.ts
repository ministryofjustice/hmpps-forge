import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { ValidationExpr } from '@form-engine/form/types/structures.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'

/**
 * ValidationFactory: Creates Validation expression AST nodes
 *
 * Validation expressions implement field validation rules.
 * Contains predicate condition and error message.
 */
export default class ValidationFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Validation expression: Field validation rules
   */
  create(json: ValidationExpr): ValidationASTNode {
    const properties: {
      when: ASTNode
      message: ASTNode | string
      submissionOnly?: boolean
      details?: Record<string, any>
    } = {
      when: this.nodeFactory.createNode(json.when),
      message: this.nodeFactory.transformValue(json.message || ''),
      submissionOnly: false,
    }

    if (json.submissionOnly !== undefined) {
      properties.submissionOnly = json.submissionOnly
    }

    if (json.details) {
      properties.details = this.nodeFactory.transformValue(json.details)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.VALIDATION,
      properties,
      raw: json,
    }
  }
}
