import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { PostPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * PostPseudoNodeWiring: Wires Post pseudo nodes to their consumers
 *
 * Creates dependency edges for raw form submission data:
 * - Post values represent raw form data before any formatting/transformation
 *
 * Wiring pattern for POST:
 * - POST → Post() references (consumers)
 */
export default class PostPseudoNodeWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Post pseudo nodes to their consumers
   */
  wire() {
    this.wiringContext.findPseudoNodesByType<PostPseudoNode>(PseudoNodeType.POST)
      .forEach(postPseudoNode => {
        this.wireConsumers(postPseudoNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Handles both directions:
   * - New pseudo nodes: no wiring needed (no producers, consumers handled below)
   * - New references: wire existing/new pseudo nodes to them
   *
   * Note: We don't call wireConsumers for new pseudo nodes because:
   * 1. Existing references can't reference a field code that was just created
   * 2. New references in the same batch are handled by the "Handle new references" section
   */
  wireNodes(nodeIds: NodeId[]) {
    const nodes = nodeIds.map(id => this.wiringContext.nodeRegistry.get(id))

    // New Post pseudo nodes don't need producer wiring (raw input)
    // Consumers are wired below when we process new references

    // Handle new Post() references (PUSH: existing pseudo node → new reference)
    const postRefs = nodes
      .filter(isReferenceExprNode)
      .filter(ref => {
        const path = ref.properties.path

        return Array.isArray(path) && path.length >= 2 && path[0] === 'post'
      })

    postRefs.forEach(refNode => {
      const baseFieldCode = refNode.properties.path[1] as string

      const pseudoNode = this.wiringContext.findPseudoNode<PostPseudoNode>(PseudoNodeType.POST, baseFieldCode)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'post',
          fieldCode: baseFieldCode,
        })
      }
    })
  }

  /**
   * Wire a post pseudo node to its consumers (Post reference nodes)
   *
   * Finds all Post() reference nodes that reference this field and creates
   * edges: POST_PSEUDO_NODE → Post() reference
   *
   * Example: Post('field_name') creates a reference that consumes the
   * POST pseudo node for 'field_name'
   */
  private wireConsumers(postPseudoNode: PostPseudoNode) {
    const { baseFieldCode } = postPseudoNode.properties
    const postRefs = this.wiringContext.findReferenceNodes('post')

    postRefs.forEach(refNode => {
      const path = refNode.properties.path

      if (path.length >= 2) {
        const referencedBaseCode = path[1] as string

        if (referencedBaseCode === baseFieldCode) {
          this.wiringContext.graph.addEdge(postPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
            referenceType: 'post',
            fieldCode: baseFieldCode,
          })
        }
      }
    })
  }
}
