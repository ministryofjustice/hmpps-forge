import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import {
  AnswerLocalPseudoNode,
  AnswerRemotePseudoNode,
  PostPseudoNode,
  PseudoNodeType,
} from '@form-engine/core/types/pseudoNodes.type'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isPipelineExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * AnswerPseudoNodeWiring: Wires Answer pseudo nodes to their data sources and consumers
 *
 * Creates dependency edges for field answer values:
 * - Local answers: Field values from current step (Answer.Local pseudo nodes)
 * - Remote answers: Field values from other steps (Answer.Remote pseudo nodes)
 *
 * Wiring pattern for ANSWER_LOCAL:
 * - POST → ANSWER_LOCAL (raw form data, if no formatPipeline)
 * - FORMAT_PIPELINE → ANSWER_LOCAL (transformed data, if formatPipeline exists)
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
    this.wiringContext.findPseudoNodesByType<AnswerLocalPseudoNode>(PseudoNodeType.ANSWER_LOCAL)
      .forEach(answerPseudoNode => {
        this.wireLocalProducers(answerPseudoNode)
        this.wireConsumers(answerPseudoNode)
      })

    this.wiringContext.findPseudoNodesByType<AnswerRemotePseudoNode>(PseudoNodeType.ANSWER_REMOTE)
      .forEach(answerPseudoNode => {
        this.wireRemoteProducers(answerPseudoNode)
        this.wireConsumers(answerPseudoNode)
      })
  }

  /**
   * Wire data sources (producers) to a local answer pseudo node
   *
   * Local answers can be produced by:
   * - formatPipeline (if exists) - transforms POST data before storage
   * - POST pseudo node (if no formatPipeline) - raw form submission data
   * - defaultValue expression (if exists) - default when no POST data exists
   * - onLoad transition (if exists) - pre-populated value from effects
   *
   * Note: formatPipeline contains its own POST reference, creating the chain:
   * POST → FORMAT_PIPELINE → ANSWER_LOCAL
   */
  private wireLocalProducers(answerPseudoNode: AnswerLocalPseudoNode) {
    const { baseFieldCode, fieldNodeId: baseFieldNodeId } = answerPseudoNode.properties
    const fieldNode = this.wiringContext.nodeRegistry.get(baseFieldNodeId) as BlockASTNode

    // Wire formatter pipeline, this itself has a Post('field_code') reference,
    // so it the graph still works out correctly. If no formatter pipeline, just wire to Post('field_name')
    const formatPipelineNode = fieldNode.properties.get('formatPipeline')

    if (isPipelineExprNode(formatPipelineNode)) {
      // Wire formatter Pipeline
      this.wiringContext.graph.addEdge(formatPipelineNode.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        propertyName: 'formatPipeline',
        fieldCode: baseFieldCode,
      })
    } else {
      // Wire the POST pseudo node
      const postNode = this.wiringContext.findPseudoNode<PostPseudoNode>(PseudoNodeType.POST, baseFieldCode)

      if (postNode) {
        this.wiringContext.graph.addEdge(postNode.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: baseFieldCode,
        })
      }
    }

    const defaultValue = fieldNode.properties.get('defaultValue')

    if (isASTNode(defaultValue)) {
      this.wiringContext.graph.addEdge(defaultValue.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        propertyName: 'defaultValue',
        fieldCode: answerPseudoNode.properties.baseFieldCode,
      })
    }

    // Wire the on load transition
    const nearestOnLoadTransition = this.wiringContext.findLastOnLoadTransitionFrom(this.wiringContext.getStepNode().id)

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
    const nearestOnLoadTransition = this.wiringContext.findLastOnLoadTransitionFrom(this.wiringContext.getStepNode().id)

    if (nearestOnLoadTransition) {
      this.wiringContext.graph.addEdge(nearestOnLoadTransition.id, answerPseudoNode.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: baseFieldCode,
      })
    }
  }

  /**
   * Wire an answer pseudo node to its consumers (Answer reference nodes)
   *
   * Finds all Answer() reference nodes that reference this field and creates
   * edges: ANSWER_PSEUDO_NODE → Answer() reference
   */
  private wireConsumers(answerPseudoNode: AnswerLocalPseudoNode | AnswerRemotePseudoNode) {
    const { baseFieldCode } = answerPseudoNode.properties
    const answerRefs = this.wiringContext.findReferenceNodes('answers')

    answerRefs.forEach(refNode => {
      const path = refNode.properties.get('path') as string[]

      if (path.length >= 2) {
        const referencedField = path[1] as string
        const baseCode = referencedField.split('.')[0]

        if (baseCode === baseFieldCode) {
          this.wiringContext.graph.addEdge(answerPseudoNode.id, refNode.id, DependencyEdgeType.DATA_FLOW, {
            referenceType: 'answer',
            fieldCode: baseFieldCode,
          })
        }
      }
    })
  }
}
