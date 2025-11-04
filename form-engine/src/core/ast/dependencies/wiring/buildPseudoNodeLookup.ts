import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * Build lookup maps for pseudo nodes by type and key
 */
export function buildPseudoNodeLookup(pseudoNodeRegistry: NodeRegistry): Map<PseudoNodeType, Map<string, NodeId>> {
  const lookup = new Map<PseudoNodeType, Map<string, NodeId>>()

  // Initialize maps for each pseudo node type
  lookup.set(PseudoNodeType.POST, new Map())
  lookup.set(PseudoNodeType.QUERY, new Map())
  lookup.set(PseudoNodeType.PARAMS, new Map())
  lookup.set(PseudoNodeType.DATA, new Map())
  lookup.set(PseudoNodeType.ANSWER, new Map())

  // Populate maps
  pseudoNodeRegistry.getAll().forEach((node, nodeId) => {
    const nodeType = node.type
    const typeMap = lookup.get(nodeType as PseudoNodeType)

    // Extract key based on node type
    let key: string | undefined

    if (node.type === PseudoNodeType.POST) {
      key = node.metadata.fieldCode
    } else if (node.type === PseudoNodeType.QUERY) {
      key = node.metadata.paramName
    } else if (node.type === PseudoNodeType.PARAMS) {
      key = node.metadata.paramName
    } else if (node.type === PseudoNodeType.DATA) {
      key = node.metadata.dataKey
    } else if (node.type === PseudoNodeType.ANSWER) {
      key = node.metadata.fieldCode
    }

    if (key) {
      typeMap.set(key, nodeId)
    }
  })

  return lookup
}
