import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType } from '../../../../../../authoring/types/enums'
import { ValidationASTNode } from '../../../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../../../contracts/ast/engine.type'
import type { ValidationExpr } from '../../../../../../authoring/types/structures.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
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
      groups?: string[]
      details?: Record<string, unknown>
    } = {
      condition: this.nodeFactory.createChildNode(json.condition, 'condition'),
      message: this.nodeFactory.transformChild(json.message || '', 'message'),
      submissionOnly: false,
      groups: json.groups ?? ['default'],
    }

    if (json.submissionOnly !== undefined) {
      properties.submissionOnly = json.submissionOnly
    }

    if (json.details) {
      properties.details = this.nodeFactory.transformChild(json.details, 'details')
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.VALIDATION,
      properties,
    }
  }
}
