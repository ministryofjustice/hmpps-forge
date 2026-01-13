import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { QueryPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'

/**
 * QueryWiring: Wires Query pseudo nodes to their consumers
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
export default class QueryWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Query pseudo nodes to their consumers
   */
  wire() {
    this.wiringContext.nodeRegistry.findByType<QueryPseudoNode>(PseudoNodeType.QUERY)
      .forEach(queryPseudoNode => {
        this.wireConsumers(queryPseudoNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Handles both directions:
   * - New pseudo nodes: no wiring needed (no producers, consumers handled below)
   * - New references: wire existing/new pseudo nodes to them
   *
   * Note: We don't call wireConsumers for new pseudo nodes because:
   * 1. Existing references can't reference a param that was just created
   * 2. New references in the same batch are handled by the "Handle new references" section
   */
  wireNodes(nodeIds: NodeId[]) {
    const nodes = nodeIds.map(id => this.wiringContext.nodeRegistry.get(id))

    // New Query pseudo nodes don't need producer wiring (URL input)
    // Consumers are wired below when we process new references

    // Handle new Query() references (PUSH: existing pseudo node → new reference)
    const queryRefs = nodes
      .filter(isReferenceExprNode)
      .filter(ref => {
        const path = ref.properties.path

        return Array.isArray(path) && path.length >= 2 && path[0] === 'query'
      })

    queryRefs.forEach(refNode => {
      const paramName = refNode.properties.path[1] as string

      const pseudoNode = this.wiringContext.nodeRegistry.findByType<QueryPseudoNode>(PseudoNodeType.QUERY)
        .find(node => getPseudoNodeKey(node) === paramName)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'query',
          paramName,
        })
      }
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
      const path = refNode.properties.path

      if (path.length >= 2 && path[1] === paramName) {
        this.wiringContext.graph.addEdge(queryPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'query',
          paramName,
        })
      }
    })
  }
}
