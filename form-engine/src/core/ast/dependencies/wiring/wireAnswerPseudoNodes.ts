import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ScopeIndex from '@form-engine/core/ast/dependencies/ScopeIndex'
import { PseudoNodeType, AnswerPseudoNode, PostPseudoNode } from '@form-engine/core/types/pseudoNodes.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * Phase 2: Wire Answer pseudo nodes
 * Answer → POST or formatPipeline (exclusive), defaultValue, onLoad
 *
 * Resolution strategy for Answer values:
 * 1. If field has formatPipeline → wire formatPipeline → Answer
 * 2. Else → wire POST → Answer
 * 3. Always wire defaultValue → Answer (fallback when POST/pipeline is empty)
 * 4. Wire onLoad transitions → Answer (if field has scope)
 */
export function wireAnswerPseudoNodes(
  astNodeRegistry: NodeRegistry,
  pseudoNodeRegistry: NodeRegistry,
  graph: DependencyGraph,
  scopeIndex: ScopeIndex,
): void {
  const lookupMaps = buildLookupMaps(pseudoNodeRegistry)

  pseudoNodeRegistry.getAll().forEach((node, nodeId) => {
    if (node.type !== PseudoNodeType.ANSWER) {
      return
    }

    const answerNode = node as AnswerPseudoNode
    const fieldNode = getFieldNode(answerNode, astNodeRegistry)

    wireDataSource(answerNode, nodeId, fieldNode, lookupMaps, graph)
    wireDefaultValue(fieldNode, nodeId, graph)
    wireOnLoadTransitions(answerNode, nodeId, scopeIndex, graph)
  })
}

/**
 * Build lookup maps for quick pseudo node resolution
 */
function buildLookupMaps(pseudoNodeRegistry: NodeRegistry) {
  const answerNodeByFieldCode = new Map<string, NodeId>()
  const postNodeByFieldCode = new Map<string, NodeId>()

  pseudoNodeRegistry.getAll().forEach((node, nodeId) => {
    if (node.type === PseudoNodeType.ANSWER) {
      const answerNode = node as AnswerPseudoNode
      answerNodeByFieldCode.set(answerNode.metadata.fieldCode, nodeId)
    }

    if (node.type === PseudoNodeType.POST) {
      const postNode = node as PostPseudoNode
      postNodeByFieldCode.set(postNode.metadata.fieldCode, nodeId)
    }
  })

  return { answerNodeByFieldCode, postNodeByFieldCode }
}

/**
 * Get the field AST node for an answer pseudo node
 */
function getFieldNode(answerNode: AnswerPseudoNode, astNodeRegistry: NodeRegistry): BlockASTNode | undefined {
  const { fieldNodeId } = answerNode.metadata

  if (!fieldNodeId) {
    return undefined
  }

  const fieldNode = astNodeRegistry.get(fieldNodeId)

  return isBlockStructNode(fieldNode) ? fieldNode : undefined
}

/**
 * Wire the data source (formatPipeline or POST) to the Answer node
 */
function wireDataSource(
  answerNode: AnswerPseudoNode,
  answerNodeId: NodeId,
  fieldNode: BlockASTNode | undefined,
  lookupMaps: { postNodeByFieldCode: Map<string, NodeId> },
  graph: DependencyGraph,
): void {
  const formatPipelineId = getFormatPipelineId(fieldNode)

  if (formatPipelineId) {
    graph.addEdge(formatPipelineId, answerNodeId, DependencyEdgeType.DATA_FLOW, {
      reason: 'formatPipeline processes POST data before Answer resolution',
    })

    return
  }

  const postNodeId = lookupMaps.postNodeByFieldCode.get(answerNode.metadata.fieldCode)

  if (postNodeId) {
    graph.addEdge(postNodeId, answerNodeId, DependencyEdgeType.DATA_FLOW, {
      reason: 'POST provides raw field data',
    })
  }
}

/**
 * Get the formatPipeline ID from a field node if it exists
 */
function getFormatPipelineId(fieldNode: BlockASTNode | undefined): NodeId | undefined {
  if (!fieldNode) {
    return undefined
  }

  const formatPipeline = fieldNode.properties.get('formatPipeline')

  if (isASTNode(formatPipeline)) {
    return formatPipeline.id
  }

  return undefined
}

/**
 * Wire defaultValue to the Answer node (if it exists)
 */
function wireDefaultValue(fieldNode: BlockASTNode | undefined, answerNodeId: NodeId, graph: DependencyGraph): void {
  if (!fieldNode) {
    return
  }

  const defaultValue = fieldNode.properties.get('defaultValue')

  if (isASTNode(defaultValue)) {
    graph.addEdge(defaultValue.id, answerNodeId, DependencyEdgeType.DATA_FLOW, {
      reason: 'defaultValue provides fallback when POST is empty',
    })
  }
}

/**
 * Wire onLoad transitions to the Answer node (if field has scope)
 */
function wireOnLoadTransitions(
  answerNode: AnswerPseudoNode,
  answerNodeId: NodeId,
  scopeIndex: ScopeIndex,
  graph: DependencyGraph,
): void {
  const { fieldNodeId } = answerNode.metadata

  if (!fieldNodeId) {
    return
  }

  const scope = scopeIndex.getScope(fieldNodeId)

  if (!scope) {
    return
  }

  scope.onLoadChain.forEach(transitionId => {
    graph.addEdge(transitionId, answerNodeId, DependencyEdgeType.EFFECT_FLOW, {
      reason: 'onLoad might pre-populate this answer',
    })
  })
}
