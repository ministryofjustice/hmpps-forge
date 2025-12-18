import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * ReferenceExpressionWiring: Wires Reference expressions to their dynamic path segments
 *
 * Creates dependency edges for reference nodes that contain AST nodes in their path:
 * - Path segments can be strings, numbers, or AST nodes (for dynamic access)
 * - Any AST node in the path must be evaluated before the reference can resolve
 *
 * Wiring pattern for REFERENCE:
 * - PATH_SEGMENT → REFERENCE (dynamic path segments must be evaluated first)
 */
export default class ReferenceExpressionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all reference expressions to their dynamic path segments
   */
  wire() {
    const expressionNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isReferenceExprNode)
      .forEach(referenceNode => {
        this.wireReference(referenceNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isReferenceExprNode)
      .forEach(referenceNode => {
        this.wireReference(referenceNode)
      })
  }

  /**
   * Wire a reference expression to its dynamic path segments
   *
   * Creates edges: pathSegment → reference (for each AST node in path)
   */
  private wireReference(referenceNode: ReferenceASTNode) {
    const path = referenceNode.properties.path

    path.forEach((segment, index) => {
      if (isASTNode(segment)) {
        this.wiringContext.graph.addEdge(segment.id, referenceNode.id, DependencyEdgeType.DATA_FLOW, {
          property: 'path',
          index,
        })
      }
    })
  }
}
