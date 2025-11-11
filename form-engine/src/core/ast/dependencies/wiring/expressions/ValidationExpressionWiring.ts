import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isValidationExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * ValidationExpressionWiring: Wires validation expressions to their conditions
 *
 * Creates dependency edges for validation nodes:
 * - Validations have a condition that must be evaluated before the validation result is known
 *
 * Wiring pattern for VALIDATION:
 * - CONDITION → VALIDATION (condition must be evaluated first)
 */
export default class ValidationExpressionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all validation expressions to their condition nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isValidationExprNode)
      .forEach(validationNode => {
        this.wireValidation(validationNode)
      })
  }

  /**
   * Wire a validation expression to its condition
   *
   * Creates edge: condition → validation
   */
  private wireValidation(validationNode: ValidationASTNode) {
    const condition = validationNode.properties.get('when')

    // Wire condition → validation (condition must be evaluated before validation)
    if (isASTNode(condition)) {
      this.wiringContext.graph.addEdge(condition.id, validationNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }
  }
}
