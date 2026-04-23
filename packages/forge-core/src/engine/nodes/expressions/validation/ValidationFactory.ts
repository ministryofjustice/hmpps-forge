import { ASTNodeType } from '../../../types/enums'
import { ExpressionType } from '../../../../authoring/types/enums'
import { ValidationASTNode } from '../../../types/expressions.type'
import { ASTNode } from '../../../types/engine.type'
import type { ValidationExpr } from '../../../../authoring/types/structures.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

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
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Validation expression: Field validation rules
   */
  create(json: ValidationExpr): ValidationASTNode {
    const properties: {
      condition: ASTNode
      message: ASTNode | string
      submissionOnly?: boolean
      details?: Record<string, any>
    } = {
      condition: this.nodeFactory.createNode(json.condition),
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
