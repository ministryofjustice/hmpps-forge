import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import {
  AnswerLocalPseudoNode,
  AnswerRemotePseudoNode,
  PostPseudoNode,
  PseudoNodeType,
} from '@form-engine/core/types/pseudoNodes.type'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode, isPseudoNode } from '@form-engine/core/typeguards/nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'

/**
 * AnswerPseudoNodeWiring: Wires Answer pseudo nodes to their data sources and consumers
 *
 * Creates dependency edges for field answer values:
 * - Local answers: Field values from current step (Answer.Local pseudo nodes)
 * - Remote answers: Field values from other steps (Answer.Remote pseudo nodes)
 *
 * Wiring pattern for ANSWER_LOCAL:
 * - POST → ANSWER_LOCAL (raw form data)
 * - FORMATTERS[] → ANSWER_LOCAL (transformer functions, executed inline)
 * - DEFAULT_VALUE → ANSWER_LOCAL (default value expression)
 * - ONLOAD_TRANSITION → ANSWER_LOCAL (pre-population from onLoad effects)
 * - ANSWER_LOCAL → Answer() references (consumers)
 *
 * Wiring pattern for ANSWER_REMOTE:
 * - ONLOAD_TRANSITION → ANSWER_REMOTE (loaded from remote source)
 * - ANSWER_REMOTE → Answer() references (consumers)
 */
export default class AnswerPseudoNodeWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all Answer pseudo nodes to their producers and consumers
   * Handles both local and remote answer nodes
   */
  wire() {
    const answerRefsByFieldCode = this.buildAnswerRefsIndex()

    this.wiringContext.findPseudoNodesByType<AnswerLocalPseudoNode>(PseudoNodeType.ANSWER_LOCAL)
      .forEach(answerPseudoNode => {
        this.wireLocalProducers(answerPseudoNode)
        this.wireConsumersFromIndex(answerPseudoNode, answerRefsByFieldCode)
      })

    this.wiringContext.findPseudoNodesByType<AnswerRemotePseudoNode>(PseudoNodeType.ANSWER_REMOTE)
      .forEach(answerPseudoNode => {
        this.wireRemoteProducers(answerPseudoNode)
        this.wireConsumersFromIndex(answerPseudoNode, answerRefsByFieldCode)
      })
  }

  /**
   * Build an index of Answer references by field code
   * Scans all expression nodes ONCE and groups by the referenced field code
   */
  private buildAnswerRefsIndex(): Map<string, import('@form-engine/core/types/expressions.type').ReferenceASTNode[]> {
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
   * Wire consumers using pre-built index (O(1) lookup per pseudo node)
   */
  private wireConsumersFromIndex(
    answerPseudoNode: AnswerLocalPseudoNode | AnswerRemotePseudoNode,
    answerRefsByFieldCode: Map<string, import('@form-engine/core/types/expressions.type').ReferenceASTNode[]>,
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
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Handles both directions:
   * - New pseudo nodes: wire producers only (consumers handled below via new references)
   * - New references: wire existing/new pseudo nodes to them
   *
   * Note: We don't call wireConsumers for new pseudo nodes because:
   * 1. Existing references can't reference a field code that was just created
   * 2. New references in the same batch are handled by the "Handle new references" section
   */
  wireNodes(nodeIds: NodeId[]) {
    const nodes = nodeIds.map(id => this.wiringContext.nodeRegistry.get(id))

    // Handle new Answer pseudo nodes (PULL producers only)
    // Consumers are wired below when we process new references
    nodes
      .filter(isPseudoNode)
      .filter((node): node is AnswerLocalPseudoNode => node.type === PseudoNodeType.ANSWER_LOCAL)
      .forEach(pseudoNode => {
        this.wireLocalProducers(pseudoNode)
      })

    nodes
      .filter(isPseudoNode)
      .filter((node): node is AnswerRemotePseudoNode => node.type === PseudoNodeType.ANSWER_REMOTE)
      .forEach(pseudoNode => {
        this.wireRemoteProducers(pseudoNode)
      })

    // Handle new Answer() references (PUSH: existing pseudo node → new reference)
    const answerRefs = nodes.filter(isReferenceExprNode).filter(ref => {
      const path = ref.properties.path

      return Array.isArray(path) && path.length >= 2 && path[0] === 'answers'
    })

    answerRefs.forEach(refNode => {
      const baseFieldCode = refNode.properties.path[1] as string

      // Find the matching pseudo node (could be local or remote)
      const pseudoNode =
        this.wiringContext.findPseudoNode<AnswerLocalPseudoNode>(PseudoNodeType.ANSWER_LOCAL, baseFieldCode) ??
        this.wiringContext.findPseudoNode<AnswerRemotePseudoNode>(PseudoNodeType.ANSWER_REMOTE, baseFieldCode)

      if (pseudoNode) {
        this.wiringContext.graph.addEdge(pseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'answer',
          fieldCode: baseFieldCode,
        })
      }
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
  private wireLocalProducers(answerPseudoNode: AnswerLocalPseudoNode) {
    const { baseFieldCode, fieldNodeId: baseFieldNodeId } = answerPseudoNode.properties
    const fieldNode = this.wiringContext.nodeRegistry.get(baseFieldNodeId) as FieldBlockASTNode

    // Always wire POST pseudo node - AnswerLocalHandler reads from it directly
    const postNode = this.wiringContext.findPseudoNode<PostPseudoNode>(PseudoNodeType.POST, baseFieldCode)

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

  /**
   * Wire data sources (producers) to a remote answer pseudo node
   *
   * Remote answers are from fields in other steps, loaded via onLoad transitions.
   * They only have one producer: the nearest onLoad transition that loads remote data.
   */
  private wireRemoteProducers(answerPseudoNode: AnswerRemotePseudoNode) {
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
