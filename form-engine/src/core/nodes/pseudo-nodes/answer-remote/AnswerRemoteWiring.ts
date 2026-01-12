import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { AnswerRemotePseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { getPseudoNodeKey } from '@form-engine/core/ast/registration/pseudoNodeKeyExtractor'

/**
 * AnswerRemoteWiring: Wires Answer.Remote pseudo nodes to their data sources and consumers
 *
 * Creates dependency edges for remote field answer values (fields from other steps).
 *
 * Wiring pattern for ANSWER_REMOTE:
 * - ONLOAD_TRANSITION → ANSWER_REMOTE (loaded from remote source)
 * - ANSWER_REMOTE → Answer() references (consumers)
 */
export default class AnswerRemoteWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Answer.Remote pseudo nodes to their producers and consumers
   */
  wire() {
    const answerRefsByFieldCode = this.buildAnswerRefsIndex()

    this.wiringContext.nodeRegistry.findByType<AnswerRemotePseudoNode>(PseudoNodeType.ANSWER_REMOTE)
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

    // Handle new Answer.Remote pseudo nodes
    nodes
      .filter(isPseudoNode)
      .filter((node): node is AnswerRemotePseudoNode => node.type === PseudoNodeType.ANSWER_REMOTE)
      .forEach(pseudoNode => {
        this.wireProducers(pseudoNode)
      })

    // Handle new Answer() references pointing to remote fields
    const answerRefs = nodes.filter(isReferenceExprNode).filter(ref => {
      const path = ref.properties.path

      return Array.isArray(path) && path.length >= 2 && path[0] === 'answers'
    })

    answerRefs.forEach(refNode => {
      const baseFieldCode = refNode.properties.path[1] as string
      const pseudoNode = this.wiringContext.nodeRegistry.findByType<AnswerRemotePseudoNode>(PseudoNodeType.ANSWER_REMOTE)
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
    answerPseudoNode: AnswerRemotePseudoNode,
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
   * Wire data sources (producers) to a remote answer pseudo node
   *
   * Remote answers are from fields in other steps, loaded via onLoad transitions.
   * They only have one producer: the nearest onLoad transition that loads remote data.
   */
  private wireProducers(answerPseudoNode: AnswerRemotePseudoNode) {
    const { baseFieldCode } = answerPseudoNode.properties

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
