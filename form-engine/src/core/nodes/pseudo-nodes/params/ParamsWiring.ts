import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { ParamsPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { getPseudoNodeKey } from '@form-engine/core/ast/registration/pseudoNodeKeyExtractor'

/**
 * ParamsWiring: Wires Params pseudo nodes to their consumers
 *
 * Creates dependency edges for URL path parameter values:
 * - Path parameters are available directly from the request URL
 * - No dependencies on onLoad transitions (always available)
 *
 * Wiring pattern for PARAMS:
 * - PARAMS → Params() references (consumers)
 *
 * Unlike Answer or Data pseudo nodes, Params nodes have no producers since
 * they are extracted directly from the URL path.
 */
export default class ParamsWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Params pseudo nodes to their consumers
   */
  wire() {
    this.wiringContext.nodeRegistry.findByType<ParamsPseudoNode>(PseudoNodeType.PARAMS)
      .forEach(paramsPseudoNode => {
        this.wireConsumers(paramsPseudoNode)
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

    // New Params pseudo nodes don't need producer wiring (URL input)
    // Consumers are wired below when we process new references

    // Handle new Params() references (PUSH: existing pseudo node → new reference)
    const paramsRefs = nodes
      .filter(isReferenceExprNode)
      .filter(ref => {
        const path = ref.properties.path

        return Array.isArray(path) && path.length >= 2 && path[0] === 'params'
      })

    paramsRefs.forEach(refNode => {
      const paramName = refNode.properties.path[1] as string

      const pseudoNode = this.wiringContext.nodeRegistry.findByType<ParamsPseudoNode>(PseudoNodeType.PARAMS)
        .find(node => getPseudoNodeKey(node) === paramName)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'params',
          paramName,
        })
      }
    })
  }

  /**
   * Wire a params pseudo node to its consumers (Params reference nodes)
   *
   * Finds all Params() reference nodes that reference this parameter and creates
   * edges: PARAMS_PSEUDO_NODE → Params() reference
   */
  private wireConsumers(paramsPseudoNode: ParamsPseudoNode) {
    const { paramName } = paramsPseudoNode.properties
    const paramsRefs = this.wiringContext.findReferenceNodes('params')

    paramsRefs.forEach(refNode => {
      const path = refNode.properties.path

      if (path.length >= 2 && path[1] === paramName) {
        this.wiringContext.graph.addEdge(paramsPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'params',
          paramName,
        })
      }
    })
  }
}
