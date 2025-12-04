import { NodeId } from '@form-engine/core/types/engine.type'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'

/**
 * Walk up the parent chain from a node and collect all ancestor NodeIds
 *
 * Uses the `attachedToParentNode` metadata to traverse upward from the
 * starting node to the root. Returns ancestors in order from outermost
 * (root) to innermost (the starting node itself).
 *
 * @param startNodeId - The node to start walking from
 * @param metadataRegistry - Registry containing parent metadata
 * @returns Array of NodeIds from outermost ancestor to startNodeId
 *
 * @example
 * // For a structure: Journey -> Step -> Block
 * // Starting from Block, returns: [JourneyId, StepId, BlockId]
 * const chain = getAncestorChain(blockId, metadataRegistry)
 */
export default function getAncestorChain(startNodeId: NodeId, metadataRegistry: MetadataRegistry): NodeId[] {
  const ancestors: NodeId[] = []
  let currentId: NodeId | undefined = startNodeId

  while (currentId) {
    ancestors.push(currentId)
    currentId = metadataRegistry.get<NodeId>(currentId, 'attachedToParentNode')
  }

  // Reverse to get outermost-first order
  ancestors.reverse()

  return ancestors
}
