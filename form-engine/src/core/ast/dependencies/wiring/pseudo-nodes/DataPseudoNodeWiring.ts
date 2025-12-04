import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DataPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'

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
   * Wire data sources (producers) to a data pseudo node
   *
   * Data values are loaded via onLoad transitions from external sources.
   * They only have one producer: the nearest onLoad transition that loads data.
   */
  private wireProducers(dataPseudoNode: DataPseudoNode) {
    const { baseFieldCode } = dataPseudoNode.properties

    const nearestOnLoadTransition = this.wiringContext.findLastOnLoadTransitionFrom(
      this.wiringContext.getCurrentStepNode().id,
    )

    if (nearestOnLoadTransition) {
      this.wiringContext.graph.addEdge(nearestOnLoadTransition.id, dataPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: baseFieldCode,
      })
    }
  }

  /**
   * Wire a data pseudo node to its consumers (Data reference nodes)
   *
   * Finds all Data() reference nodes that reference this field and creates
   * edges: DATA_PSEUDO_NODE → Data() reference
   */
  private wireConsumers(dataPseudoNode: DataPseudoNode) {
    const { baseFieldCode } = dataPseudoNode.properties
    const dataRefs = this.wiringContext.findReferenceNodes('data')

    dataRefs.forEach(refNode => {
      const path = refNode.properties.path

      if (path.length >= 2) {
        const referencedField = path[1] as string
        const baseCode = referencedField.split('.')[0]

        if (baseCode === baseFieldCode) {
          this.wiringContext.graph.addEdge(dataPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
            referenceType: 'data',
            fieldCode: baseFieldCode,
          })
        }
      }
    })
  }
}
