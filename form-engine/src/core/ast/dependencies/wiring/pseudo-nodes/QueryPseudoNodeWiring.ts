import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { QueryPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'

/**
 * QueryPseudoNodeWiring: Wires Query pseudo nodes to their consumers
 *
 * Creates dependency edges for URL query parameter values:
 * - Query parameters are available directly from the request URL
 * - No dependencies on onLoad transitions (always available)
 *
 * Wiring pattern for QUERY:
 * - QUERY → Query() references (consumers)
 *
 * Unlike Answer or Data pseudo nodes, Query nodes have no producers since
 * they are extracted directly from the URL query string.
 */
export default class QueryPseudoNodeWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Query pseudo nodes to their consumers
   */
  wire() {
    this.wiringContext.findPseudoNodesByType<QueryPseudoNode>(PseudoNodeType.QUERY)
      .forEach(queryPseudoNode => {
        this.wireConsumers(queryPseudoNode)
      })
  }

  /**
   * Wire a query pseudo node to its consumers (Query reference nodes)
   *
   * Finds all Query() reference nodes that reference this parameter and creates
   * edges: QUERY_PSEUDO_NODE → Query() reference
   */
  private wireConsumers(queryPseudoNode: QueryPseudoNode) {
    const { paramName } = queryPseudoNode.properties
    const queryRefs = this.wiringContext.findReferenceNodes('query')

    queryRefs.forEach(refNode => {
      const path = refNode.properties.get('path') as string[]

      if (path.length >= 2 && path[1] === paramName) {
        this.wiringContext.graph.addEdge(queryPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'query',
          paramName,
        })
      }
    })
  }
}
