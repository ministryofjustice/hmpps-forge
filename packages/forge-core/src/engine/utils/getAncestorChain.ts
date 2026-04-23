import { NodeId } from '../types/engine.type'
import ASTNodeTree from '../compilation/node-tree/ASTNodeTree'

/**
 * Walk up the parent chain from a node and collect all ancestor NodeIds
 *
 * Uses ASTNodeTree parent edges to traverse upward from the starting node to
 * the root. Returns ancestors in order from outermost root to the starting node.
 *
 * @param startNodeId - The node to start walking from
 * @param astNodeTree - Tree containing parent edges
 * @returns Array of NodeIds from outermost ancestor to startNodeId
 *
 * @example
 * // For a structure: Journey -> Step -> Block
 * // Starting from Block, returns: [JourneyId, StepId, BlockId]
 * const chain = getAncestorChain(blockId, astNodeTree)
 */
export default function getAncestorChain(startNodeId: NodeId, astNodeTree: ASTNodeTree): NodeId[] {
  const ancestors: NodeId[] = []
  let currentId: NodeId | undefined = startNodeId

  while (currentId) {
    ancestors.push(currentId)
    currentId = astNodeTree.getParent(currentId)
  }

  ancestors.reverse()

  return ancestors
}
