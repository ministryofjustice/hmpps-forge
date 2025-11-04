import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ScopeIndex from '@form-engine/core/ast/dependencies/ScopeIndex'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { buildPseudoNodeLookup } from '@form-engine/core/ast/dependencies/wiring/buildPseudoNodeLookup'

export function wireDataPseudoNodes(
  astNodeRegistry: NodeRegistry,
  pseudoNodeRegistry: NodeRegistry,
  graph: DependencyGraph,
  scopeIndex: ScopeIndex,
): void {
  const pseudoNodeLookup = buildPseudoNodeLookup(pseudoNodeRegistry)
  const dataNodeByKey = pseudoNodeLookup.get(PseudoNodeType.DATA)!

  // Find all Data() references in AST
  astNodeRegistry.getAll().forEach((node, nodeId) => {
    if (isReferenceExprNode(node)) {
      const path = node.properties?.get('path')

      if (Array.isArray(path) && path.length >= 2) {
        const [refType, key] = path

        if (refType === 'data' && typeof key === 'string') {
          // Found a Data() reference - wire to onLoad transitions in scope
          const dataNodeId = dataNodeByKey.get(key)

          if (!dataNodeId) {
            // Data pseudo node doesn't exist - this shouldn't happen if discovery worked correctly
            return
          }

          // Get scope of the reference node (not the Data node)
          const scope = scopeIndex.getScope(nodeId)

          if (!scope) {
            // Reference node has no scope - skip
            return
          }

          // Wire onLoad transitions → Data node (transitions must execute before data is accessed)
          scope.onLoadChain.forEach(transitionId => {
            graph.addEdge(transitionId, dataNodeId, DependencyEdgeType.EFFECT_FLOW, {
              reason: 'onLoad might populate this data',
            })
          })
        }
      }
    }
  })
}
