import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'

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
    this.wireStructuralHierarchy()
  }

  /**
   * Wire structural edges from parents to their direct children
   * Uses metadata registry to find parent-child relationships
   */
  private wireStructuralHierarchy() {
    const allNodes = Array.from(this.wiringContext.nodeRegistry.getAll().values())

    allNodes.forEach(node => {
      const parentId = this.wiringContext.getParentNodeId(node.id)

      if (!parentId) {
        return
      }

      const parentNode = this.wiringContext.nodeRegistry.get(parentId)

      // Only wire if parent is a structural node
      // Edge direction: child → parent (children evaluated before parents)
      if (isJourneyStructNode(parentNode) || isStepStructNode(parentNode) || isBlockStructNode(parentNode)) {
        this.wiringContext.graph.addEdge(node.id, parentId, DependencyEdgeType.STRUCTURAL, {
          type: 'child-parent',
        })
      }
    })
  }
}
