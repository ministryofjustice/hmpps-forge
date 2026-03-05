import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'
import { PseudoNodeType, SessionPseudoNode } from '@form-engine/core/types/pseudoNodes.type'

export default class SessionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  wire() {
    this.wiringContext.nodeRegistry.findByType<SessionPseudoNode>(PseudoNodeType.SESSION)
      .forEach(sessionPseudoNode => {
        this.wireConsumers(sessionPseudoNode)
      })
  }

  wireNodes(nodeIds: NodeId[]) {
    const nodes = nodeIds.map(id => this.wiringContext.nodeRegistry.get(id))

    const sessionRefs = nodes
      .filter(isReferenceExprNode)
      .filter(ref => {
        const path = ref.properties.path

        return Array.isArray(path) && path.length >= 2 && path[0] === 'session'
      })

    sessionRefs.forEach(refNode => {
      const baseSessionKey = refNode.properties.path[1]

      if (typeof baseSessionKey !== 'string') {
        return
      }

      const pseudoNode = this.wiringContext.nodeRegistry.findByType<SessionPseudoNode>(PseudoNodeType.SESSION)
        .find(node => getPseudoNodeKey(node) === baseSessionKey)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'session',
          baseSessionKey,
        })
      }
    })
  }

  private wireConsumers(sessionPseudoNode: SessionPseudoNode) {
    const { baseSessionKey } = sessionPseudoNode.properties
    const sessionRefs = this.wiringContext.findReferenceNodes('session')

    sessionRefs.forEach(refNode => {
      const path = refNode.properties.path

      if (path.length >= 2 && path[1] === baseSessionKey) {
        this.wiringContext.graph.addEdge(sessionPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'session',
          baseSessionKey,
        })
      }
    })
  }
}
