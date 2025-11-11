import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ConditionalASTNode, ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isConditionalExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * ConditionalExpressionWiring: Wires conditional expressions to their branches
 *
 * Creates dependency edges for conditional logic nodes:
 * - Conditionals have a predicate, then branch, and else branch
 * - All branches must be evaluated before the conditional result is known
 *
 * Wiring pattern for CONDITIONAL:
 * - PREDICATE → CONDITIONAL (predicate must be evaluated first)
 * - THEN → CONDITIONAL (then branch must be evaluated)
 * - ELSE → CONDITIONAL (else branch must be evaluated)
 */
export default class ConditionalExpressionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all conditional expressions to their predicate and branch nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isConditionalExprNode)
      .forEach(conditionalNode => {
        this.wireConditional(conditionalNode)
      })
  }

  /**
   * Wire a conditional expression to its predicate, then, and else branches
   *
   * Creates edges: predicate → conditional, then → conditional, else → conditional
   */
  private wireConditional(conditionalNode: ConditionalASTNode) {
    const predicate = conditionalNode.properties.get('predicate')
    const thenValue = conditionalNode.properties.get('thenValue')
    const elseValue = conditionalNode.properties.get('elseValue')

    // Wire predicate → conditional (predicate must be evaluated before conditional)
    if (isASTNode(predicate)) {
      this.wiringContext.graph.addEdge(predicate.id, conditionalNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'predicate',
      })
    }

    // Wire then branch → conditional
    if (isASTNode(thenValue)) {
      this.wiringContext.graph.addEdge(thenValue.id, conditionalNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'thenValue',
      })
    }

    // Wire else branch → conditional
    if (isASTNode(elseValue)) {
      this.wiringContext.graph.addEdge(elseValue.id, conditionalNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'elseValue',
      })
    }
  }
}
