import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { AnswerLocalPseudoNode, PostPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode, isPseudoNode } from '@form-engine/core/typeguards/nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'

/**
 * AnswerLocalWiring: Wires Answer.Local pseudo nodes to their data sources and consumers
 *
 * Creates dependency edges for local field answer values (fields on the current step).
 *
 * Wiring pattern for ANSWER_LOCAL:
 * - POST → ANSWER_LOCAL (raw form data)
 * - FORMATTERS[] → ANSWER_LOCAL (transformer functions, executed inline)
 * - DEFAULT_VALUE → ANSWER_LOCAL (default value expression)
 * - ONLOAD_TRANSITION → ANSWER_LOCAL (pre-population from onLoad effects)
 * - ANSWER_LOCAL → Answer() references (consumers)
 */
export default class AnswerLocalWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Answer.Local pseudo nodes to their producers and consumers
   */
  wire() {
    const answerRefsByFieldCode = this.buildAnswerRefsIndex()

    this.wiringContext.nodeRegistry.findByType<AnswerLocalPseudoNode>(PseudoNodeType.ANSWER_LOCAL)
      .forEach(answerPseudoNode => {
        this.wireProducers(answerPseudoNode)
        this.wireConsumersFromIndex(answerPseudoNode, answerRefsByFieldCode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    const nodes = nodeIds.map(id => this.wiringContext.nodeRegistry.get(id))

    // Handle new Answer.Local pseudo nodes
    nodes
      .filter(isPseudoNode)
      .filter((node): node is AnswerLocalPseudoNode => node.type === PseudoNodeType.ANSWER_LOCAL)
      .forEach(pseudoNode => {
        this.wireProducers(pseudoNode)
      })

    // Handle new Answer() references pointing to local fields
    const answerRefs = nodes.filter(isReferenceExprNode).filter(ref => {
      const path = ref.properties.path

      return Array.isArray(path) && path.length >= 2 && path[0] === 'answers'
    })

    answerRefs.forEach(refNode => {
      const baseFieldCode = refNode.properties.path[1] as string
      const pseudoNode = this.wiringContext.nodeRegistry.findByType<AnswerLocalPseudoNode>(PseudoNodeType.ANSWER_LOCAL)
        .find(node => getPseudoNodeKey(node) === baseFieldCode)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'answer',
          fieldCode: baseFieldCode,
        })
      }
    })
  }

  /**
   * Build an index of Answer references by field code
   */
  private buildAnswerRefsIndex(): Map<string, ReferenceASTNode[]> {
    const index = new Map<string, ReferenceASTNode[]>()

    this.wiringContext.findReferenceNodes('answers').forEach(refNode => {
      const path = refNode.properties.path

      if (path.length >= 2) {
        const fieldCode = path[1] as string

        if (!index.has(fieldCode)) {
          index.set(fieldCode, [])
        }

        index.get(fieldCode)!.push(refNode)
      }
    })

    return index
  }

  /**
   * Wire consumers using pre-built index
   */
  private wireConsumersFromIndex(
    answerPseudoNode: AnswerLocalPseudoNode,
    answerRefsByFieldCode: Map<string, ReferenceASTNode[]>,
  ) {
    const { baseFieldCode } = answerPseudoNode.properties
    const refs = answerRefsByFieldCode.get(baseFieldCode) ?? []

    refs.forEach(refNode => {
      this.wiringContext.graph.addEdge(answerPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'answer',
        fieldCode: baseFieldCode,
      })
    })
  }

  /**
   * Wire data sources (producers) to a local answer pseudo node
   *
   * Local answers can be produced by:
   * - POST pseudo node - raw form submission data
   * - formatters (if exist) - transformer functions executed inline after sanitization
   * - defaultValue expression (if exists) - default when no POST data exists
   * - onLoad transition (if exists) - pre-populated value from effects
   */
  private wireProducers(answerPseudoNode: AnswerLocalPseudoNode) {
    const { baseFieldCode, fieldNodeId: baseFieldNodeId } = answerPseudoNode.properties
    const fieldNode = this.wiringContext.nodeRegistry.get(baseFieldNodeId) as FieldBlockASTNode

    // Always wire POST pseudo node - AnswerLocalHandler reads from it directly
    const postNode = this.wiringContext.nodeRegistry.findByType<PostPseudoNode>(PseudoNodeType.POST)
      .find(node => getPseudoNodeKey(node) === baseFieldCode)

    if (postNode) {
      this.wiringContext.graph.addEdge(postNode.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: baseFieldCode,
      })
    }

    // Wire each formatter as a dependency (for async metadata computation)
    const formatters = fieldNode.properties.formatters

    if (Array.isArray(formatters)) {
      formatters.forEach((formatter, index) => {
        if (isASTNode(formatter)) {
          this.wiringContext.graph.addEdge(formatter.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
            propertyName: `formatters[${index}]`,
            fieldCode: baseFieldCode,
          })
        }
      })
    }

    const defaultValue = fieldNode.properties.defaultValue

    if (isASTNode(defaultValue)) {
      this.wiringContext.graph.addEdge(defaultValue.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        propertyName: 'defaultValue',
        fieldCode: answerPseudoNode.properties.baseFieldCode,
      })
    }

    // Wire the on load transition
    const nearestOnLoadTransition = this.wiringContext.findLastOnLoadTransitionFrom(
      this.wiringContext.getCurrentStepNode().id,
    )

    if (nearestOnLoadTransition) {
      this.wiringContext.graph.addEdge(nearestOnLoadTransition.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: baseFieldCode,
      })
    }
  }
}
