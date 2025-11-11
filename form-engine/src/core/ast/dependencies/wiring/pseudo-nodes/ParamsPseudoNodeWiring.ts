import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { ParamsPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'

/**
 * ParamsPseudoNodeWiring: Wires Params pseudo nodes to their consumers
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
export default class ParamsPseudoNodeWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Params pseudo nodes to their consumers
   */
  wire() {
    this.wiringContext.findPseudoNodesByType<ParamsPseudoNode>(PseudoNodeType.PARAMS)
      .forEach(paramsPseudoNode => {
        this.wireConsumers(paramsPseudoNode)
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
      const path = refNode.properties.get('path') as string[]

      if (path.length >= 2 && path[1] === paramName) {
        this.wiringContext.graph.addEdge(paramsPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'params',
          paramName,
        })
      }
    })
  }
}
