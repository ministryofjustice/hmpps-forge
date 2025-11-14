import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { PostPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'

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
        const referencedField = path[1] as string
        const baseCode = referencedField.split('.')[0]

        if (baseCode === baseFieldCode) {
          this.wiringContext.graph.addEdge(postPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
            referenceType: 'post',
            fieldCode: baseFieldCode,
          })
        }
      }
    })
  }
}
