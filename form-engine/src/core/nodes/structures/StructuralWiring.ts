import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * StructuralWiring: Wires parent-child relationships in the AST hierarchy
 *
 * Creates dependency edges representing structural hierarchy (bottom-up evaluation):
 * - Child journeys → parent journey
 * - Child steps → parent journey
 * - Child blocks → parent step
 * - Nested blocks → parent block
 *
 * Children are evaluated before their parents in the AST
 * Uses metadata registry's attachedToParentNode to discover relationships
 */
export default class StructuralWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all structural parent → child relationships
   */
  wire() {
    const allNodes = Array.from(this.wiringContext.nodeRegistry.getAll().values())

    allNodes.forEach(node => {
      this.wireNodeToParent(node.id)
    })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Each node wires itself to its parent
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds.forEach(nodeId => {
      this.wireNodeToParent(nodeId)
    })
  }

  /**
   * Wire a single node to its structural parent
   */
  private wireNodeToParent(nodeId: NodeId) {
    const parentId = this.wiringContext.getParentNodeId(nodeId)

    if (!parentId) {
      return
    }

    const parentNode = this.wiringContext.nodeRegistry.get(parentId)

    // Only wire if parent is a structural node
    // Edge direction: child → parent (children evaluated before parents)
    if (isJourneyStructNode(parentNode) || isStepStructNode(parentNode) || isBlockStructNode(parentNode)) {
      this.wiringContext.graph.addEdge(nodeId, parentId, DependencyEdgeType.STRUCTURAL, {
        type: 'child-parent',
      })
    }
  }
}
