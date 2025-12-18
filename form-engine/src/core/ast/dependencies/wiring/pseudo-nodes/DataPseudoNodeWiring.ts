import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DataPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * DataPseudoNodeWiring: Wires Data pseudo nodes to their data sources and consumers
 *
 * Creates dependency edges for data values loaded via onLoad transitions:
 * - Data values come from external sources (APIs, databases, etc.)
 * - Must be loaded before the step can be evaluated
 *
 * Wiring pattern for DATA:
 * - ONLOAD_TRANSITION → DATA (data loaded from external source)
 * - DATA → Data() references (consumers)
 */
export default class DataPseudoNodeWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Data pseudo nodes to their producers and consumers
   */
  wire() {
    this.wiringContext.findPseudoNodesByType<DataPseudoNode>(PseudoNodeType.DATA)
      .forEach(dataPseudoNode => {
        this.wireProducers(dataPseudoNode)
        this.wireConsumers(dataPseudoNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Handles both directions:
   * - New pseudo nodes: wire producers only (consumers handled below via new references)
   * - New references: wire existing/new pseudo nodes to them
   *
   * Note: We don't call wireConsumers for new pseudo nodes because:
   * 1. Existing references can't reference a data key that was just created
   * 2. New references in the same batch are handled by the "Handle new references" section
   */
  wireNodes(nodeIds: NodeId[]) {
    const nodes = nodeIds.map(id => this.wiringContext.nodeRegistry.get(id))

    // Handle new Data pseudo nodes (PULL producers only)
    // Consumers are wired below when we process new references
    nodes
      .filter(isPseudoNode)
      .filter((node): node is DataPseudoNode => node.type === PseudoNodeType.DATA)
      .forEach(pseudoNode => {
        this.wireProducers(pseudoNode)
      })

    // Handle new Data() references (PUSH: existing pseudo node → new reference)
    const dataRefs = nodes
      .filter(isReferenceExprNode)
      .filter(ref => {
        const path = ref.properties.path

        return Array.isArray(path) && path.length >= 2 && path[0] === 'data'
      })

    dataRefs.forEach(refNode => {
      const baseProperty = refNode.properties.path[1] as string

      const pseudoNode = this.wiringContext.findPseudoNode<DataPseudoNode>(PseudoNodeType.DATA, baseProperty)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'data',
          baseProperty,
        })
      }
    })
  }

  /**
   * Wire data sources (producers) to a data pseudo node
   *
   * Data values are loaded via onLoad transitions from external sources.
   * They only have one producer: the nearest onLoad transition that loads data.
   */
  private wireProducers(dataPseudoNode: DataPseudoNode) {
    const { baseProperty } = dataPseudoNode.properties

    const nearestOnLoadTransition = this.wiringContext.findLastOnLoadTransitionFrom(
      this.wiringContext.getCurrentStepNode().id,
    )

    if (nearestOnLoadTransition) {
      this.wiringContext.graph.addEdge(nearestOnLoadTransition.id, dataPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        baseProperty,
      })
    }
  }

  /**
   * Wire a data pseudo node to its consumers (Data reference nodes)
   *
   * Finds all Data() reference nodes that reference this property and creates
   * edges: DATA_PSEUDO_NODE → Data() reference
   */
  private wireConsumers(dataPseudoNode: DataPseudoNode) {
    const { baseProperty } = dataPseudoNode.properties
    const dataRefs = this.wiringContext.findReferenceNodes('data')

    dataRefs.forEach(refNode => {
      const path = refNode.properties.path

      if (path.length >= 2) {
        const referencedBaseProperty = path[1] as string

        if (referencedBaseProperty === baseProperty) {
          this.wiringContext.graph.addEdge(dataPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
            referenceType: 'data',
            baseProperty,
          })
        }
      }
    })
  }
}
