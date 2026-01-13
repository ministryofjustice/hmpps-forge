import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, NextASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isNextExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * NextWiring: Wires Next expressions to their dependencies
 *
 * Creates dependency edges for next nodes:
 * - Next expressions have an optional 'when' condition
 * - Next expressions have a 'goto' destination (can be AST node or string)
 *
 * Wiring pattern for NEXT:
 * - WHEN → NEXT (condition must be evaluated first)
 * - GOTO → NEXT (if goto is an AST node, it must be evaluated first)
 */
export default class NextWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all next expressions to their dependencies
   */
  wire() {
    const expressionNodes = this.wiringContext.nodeRegistry.findByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isNextExprNode)
      .forEach(nextNode => {
        this.wireNext(nextNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isNextExprNode)
      .forEach(nextNode => {
        this.wireNext(nextNode)
      })
  }

  /**
   * Wire a next expression to its dependencies
   *
   * Creates edges:
   * - when → next (condition must be evaluated before next)
   * - goto → next (if goto is an AST node)
   */
  private wireNext(nextNode: NextASTNode) {
    const when = nextNode.properties.when
    const goto = nextNode.properties.goto

    // Wire when → next (condition must be evaluated before next)
    if (isASTNode(when)) {
      this.wiringContext.graph.addEdge(when.id, nextNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }

    // Wire goto → next (if goto is an AST node, it must be evaluated first)
    if (isASTNode(goto)) {
      this.wiringContext.graph.addEdge(goto.id, nextNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
    }
  }
}
