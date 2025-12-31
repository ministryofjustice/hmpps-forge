import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'

/**
 * Setup metadata for AST nodes
 *
 * Two phases:
 * 1. setParentMetadata() - Call ONCE to set parent tracking for all nodes
 *    - attachedToParentNode: NodeId of the parent node
 *    - attachedToParentProperty: Property key on parent where this node is attached
 *
 * 2. setStepScopeMetadata() - Call PER-STEP to set step-specific flags
 *    - isDescendantOfStep: true for the step node and all its descendants
 *    - isAncestorOfStep: true for parent journeys and their direct parents
 *    - isCurrentStep: true for the target step node
 */
export class MetadataTraverser {
  constructor(private readonly metadataRegistry: MetadataRegistry) {}

  /**
   * Set parent tracking metadata for all nodes (call ONCE before per-step compilation)
   */
  setParentMetadata(rootNode: ASTNode): void {
    const ancestorPath: ASTNode[] = []

    structuralTraverse(rootNode, {
      enterNode: (node: ASTNode, ctx: StructuralContext): StructuralVisitResult => {
        if (ancestorPath.length > 0) {
          const parentNode = ancestorPath[ancestorPath.length - 1]
          const propertyKey = this.getPropertyKeyFromPath(ctx.path)

          this.metadataRegistry.set(node.id, 'attachedToParentNode', parentNode.id)

          if (propertyKey !== undefined) {
            this.metadataRegistry.set(node.id, 'attachedToParentProperty', propertyKey)
          }
        }

        ancestorPath.push(node)

        return StructuralVisitResult.CONTINUE
      },
      exitNode: (): StructuralVisitResult => {
        ancestorPath.pop()

        return StructuralVisitResult.CONTINUE
      },
    })
  }

  /**
   * Set step-specific metadata (call PER-STEP)
   *
   * Optimized to only traverse:
   * 1. Ancestors (walking UP via attachedToParentNode)
   * 2. Step subtree (walking DOWN from stepNode)
   *
   * This is O(ancestors + step_subtree) instead of O(total_nodes)
   */
  setStepScopeMetadata(_rootNode: ASTNode, stepNode: StepASTNode): void {
    // Mark the step node itself
    this.metadataRegistry.set(stepNode.id, 'isCurrentStep', true)
    this.metadataRegistry.set(stepNode.id, 'isAncestorOfStep', true)
    this.metadataRegistry.set(stepNode.id, 'isDescendantOfStep', true)

    // Walk UP: Mark all ancestors as isAncestorOfStep
    let currentId = this.metadataRegistry.get<NodeId>(stepNode.id, 'attachedToParentNode')

    while (currentId) {
      this.metadataRegistry.set(currentId, 'isAncestorOfStep', true)
      currentId = this.metadataRegistry.get<NodeId>(currentId, 'attachedToParentNode')
    }

    // Walk DOWN: Mark all descendants as isDescendantOfStep
    structuralTraverse(stepNode, {
      enterNode: (node: ASTNode): StructuralVisitResult => {
        // Skip the step node itself (already marked above)
        if (node.id !== stepNode.id) {
          this.metadataRegistry.set(node.id, 'isDescendantOfStep', true)
        }

        return StructuralVisitResult.CONTINUE
      },
    })
  }

  /**
   * Traverse a runtime node subtree, setting metadata for dynamically created nodes
   */
  traverseSubtree(runtimeNode: ASTNode): void {
    const parentNodeId = this.metadataRegistry.get<NodeId>(runtimeNode.id, 'attachedToParentNode')

    if (!parentNodeId) {
      return
    }

    const insideStep = this.metadataRegistry.get(parentNodeId, 'isDescendantOfStep')
    const ancestorPath: ASTNode[] = []

    // Reconstruct ancestor path from metadata
    let currentId = parentNodeId

    while (currentId) {
      ancestorPath.unshift({ id: currentId } as ASTNode)
      currentId = this.metadataRegistry.get<NodeId>(currentId, 'attachedToParentNode')
    }

    structuralTraverse(runtimeNode, {
      enterNode: (node: ASTNode, ctx: StructuralContext): StructuralVisitResult => {
        // Set parent metadata for runtime nodes
        if (ancestorPath.length > 0) {
          const parentNode = ancestorPath[ancestorPath.length - 1]
          const propertyKey = this.getPropertyKeyFromPath(ctx.path)

          this.metadataRegistry.set(node.id, 'attachedToParentNode', parentNode.id)

          if (propertyKey !== undefined) {
            this.metadataRegistry.set(node.id, 'attachedToParentProperty', propertyKey)
          }
        }

        if (insideStep) {
          this.metadataRegistry.set(node.id, 'isDescendantOfStep', true)
        }

        ancestorPath.push(node)

        return StructuralVisitResult.CONTINUE
      },
      exitNode: (): StructuralVisitResult => {
        ancestorPath.pop()

        return StructuralVisitResult.CONTINUE
      },
    })
  }

  private getPropertyKeyFromPath(path: (string | number)[]): string | undefined {
    for (let i = path.length - 1; i >= 0; i -= 1) {
      if (typeof path[i] === 'string') {
        return path[i] as string
      }
    }

    return undefined
  }
}
