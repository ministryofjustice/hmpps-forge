import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * ReferenceWiring: Wires Reference expressions to their dynamic path segments
 *
 * Creates dependency edges for reference nodes that contain AST nodes in their path:
 * - Path segments can be strings, numbers, or AST nodes (for dynamic access)
 * - Any AST node in the path must be evaluated before the reference can resolve
 *
 * Wiring pattern for REFERENCE:
 * - PATH_SEGMENT → REFERENCE (dynamic path segments must be evaluated first)
 */
export default class ReferenceWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all reference expressions to their dynamic path segments
   */
  wire() {
    this.wiringContext.nodeRegistry.findByType<ReferenceASTNode>(ExpressionType.REFERENCE)
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
   * Wire a reference expression to its dependencies
   *
   * Creates edges:
   * - base → reference (if base expression is present)
   * - pathSegment → reference (for each AST node in path)
   */
  private wireReference(referenceNode: ReferenceASTNode) {
    const { path, base } = referenceNode.properties

    // Wire base expression dependency (evaluates before navigating into result)
    if (isASTNode(base)) {
      this.wiringContext.graph.addEdge(base.id, referenceNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'base',
      })
    }

    // Wire dynamic path segment dependencies
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
