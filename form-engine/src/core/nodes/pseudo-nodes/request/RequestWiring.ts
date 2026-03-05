import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { RequestPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'

export default class RequestWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  wire() {
    this.wiringContext.nodeRegistry.findByType<RequestPseudoNode>(PseudoNodeType.REQUEST)
      .forEach(requestPseudoNode => {
        this.wireConsumers(requestPseudoNode)
      })
  }

  wireNodes(nodeIds: NodeId[]) {
    const nodes = nodeIds.map(id => this.wiringContext.nodeRegistry.get(id))

    const requestRefs = nodes
      .filter(isReferenceExprNode)
      .filter(ref => {
        const path = ref.properties.path

        return Array.isArray(path) && path.length >= 2 && path[0] === 'request'
      })

    requestRefs.forEach(refNode => {
      const requestPath = this.getRequestReferencePath(refNode.properties.path)

      if (!requestPath) {
        return
      }

      const pseudoNode = this.wiringContext.nodeRegistry.findByType<RequestPseudoNode>(PseudoNodeType.REQUEST)
        .find(node => getPseudoNodeKey(node) === requestPath)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'request',
          requestPath,
        })
      }
    })
  }

  private wireConsumers(requestPseudoNode: RequestPseudoNode) {
    const requestPath = getPseudoNodeKey(requestPseudoNode)
    const requestRefs = this.wiringContext.findReferenceNodes('request')

    requestRefs.forEach(refNode => {
      const refRequestPath = this.getRequestReferencePath(refNode.properties.path)

      if (requestPath && refRequestPath === requestPath) {
        this.wiringContext.graph.addEdge(requestPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'request',
          requestPath,
        })
      }
    })
  }

  private getRequestReferencePath(path: unknown[]): string | undefined {
    const [, source, key] = path

    if (source === 'url' || source === 'path' || source === 'method') {
      return source
    }

    if ((source === 'headers' || source === 'cookies' || source === 'state') && typeof key === 'string') {
      return `${source}.${key}`
    }

    return undefined
  }
}
