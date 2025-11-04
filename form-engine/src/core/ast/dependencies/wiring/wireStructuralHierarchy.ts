import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { structuralTraverse, StructuralVisitResult } from '@form-engine/core/ast/traverser/StructuralTraverser'

/**
 * Properties that should not be wired as structural dependencies
 * These are accessed through other means (e.g., Answer pseudo nodes)
 */
const EXCLUDED_PROPERTIES = new Set(['formatPipeline'])

/**
 * Uses StructuralTraverser to find all AST nodes at any depth within each node's properties,
 * including blocks nested in plain objects (e.g., radio/checkbox items with conditional reveals).
 */
export function wireStructuralHierarchy(astNodeRegistry: NodeRegistry, graph: DependencyGraph): void {
  astNodeRegistry.getAll().forEach((node, nodeId) => {
    structuralTraverse(node, {
      enterNode: (childNode, ctx) => {
        // Skip the root node itself
        if (childNode === node) {
          return StructuralVisitResult.CONTINUE
        }

        // Extract property name from path (the first string element in the path)
        const propertyName = ctx.path.find(segment => typeof segment === 'string') as string | undefined

        // Skip if this node is accessed through excluded properties
        if (propertyName && EXCLUDED_PROPERTIES.has(propertyName)) {
          return StructuralVisitResult.SKIP
        }

        // Wire child → parent structural edge
        if (isASTNode(childNode) && childNode.id) {
          graph.addEdge(childNode.id, nodeId, DependencyEdgeType.STRUCTURAL, {
            propertyName,
          })

          // SKIP children of this child node - they will be wired when we process that node
          // This ensures we only wire direct children, not grandchildren
          return StructuralVisitResult.SKIP
        }

        return StructuralVisitResult.CONTINUE
      },
    })
  })
}
