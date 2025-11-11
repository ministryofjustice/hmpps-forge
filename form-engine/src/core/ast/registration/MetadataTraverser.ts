import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitor,
  StructuralVisitResult,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'

/**
 * Setup metadata to mark which nodes are relevant for rendering a specific step
 *
 * Marks nodes with the following metadata flags:
 * - `isDescendantOfStep`: true for the step node and all its descendants
 * - `isAncestorOfStep`: true for parent journeys and their direct parents
 * - `attachedToParentNode`: NodeId of the parent node (for all nodes except root)
 * - `attachedToParentProperty`: Property key on parent where this node is attached
 */
export class MetadataTraverser implements StructuralVisitor {
  private ancestorPath: ASTNode[] = []

  private insideStep = false

  private targetStepId: string | null = null

  constructor(private readonly metadataRegistry: MetadataRegistry) {}

  /**
   * Traverse from root node, marking ancestors and descendants of the target step
   * @param rootNode The root node to start traversing from
   * @param stepNode The specific step node to find and mark
   */
  traverse(rootNode: ASTNode, stepNode: StepASTNode): void {
    this.ancestorPath = []
    this.insideStep = false
    this.targetStepId = stepNode.id

    structuralTraverse(rootNode, this)
  }

  /**
   * Called when entering a node during traversal
   * Tracks ancestors and marks nodes based on step relationship
   */
  enterNode(node: ASTNode, ctx: StructuralContext): StructuralVisitResult {
    // Set parent tracking metadata for all nodes (except root)
    if (this.ancestorPath.length > 0) {
      const parentNode = this.ancestorPath[this.ancestorPath.length - 1]
      const propertyKey = this.getPropertyKeyFromPath(ctx.path)

      this.metadataRegistry.set(node.id, 'attachedToParentNode', parentNode.id)

      if (propertyKey !== undefined) {
        this.metadataRegistry.set(node.id, 'attachedToParentProperty', propertyKey)
      }
    }

    // Check if this is the target step node
    if (node.id === this.targetStepId) {
      // Mark all ancestors as isAncestorOfStep
      this.ancestorPath.forEach(ancestor => {
        this.metadataRegistry.set(ancestor.id, 'isAncestorOfStep', true)
      })

      // Mark this step node as isAncestorOfStep
      this.metadataRegistry.set(node.id, 'isAncestorOfStep', true)

      // Set flag to mark all descendants
      this.insideStep = true
    }

    // Check if we're inside the step
    if (this.insideStep) {
      // We're inside the step, mark as descendant
      this.metadataRegistry.set(node.id, 'isDescendantOfStep', true)
    }

    // Add this node to the ancestor path
    this.ancestorPath.push(node)

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Called when exiting a node during traversal
   * Cleans up ancestor tracking
   */
  exitNode(node: ASTNode): StructuralVisitResult {
    // Always pop from ancestor path
    this.ancestorPath.pop()

    // If we're exiting the target step node, reset the flag
    // Continue traversal to set parent metadata for all nodes in the tree
    if (node.id === this.targetStepId) {
      this.insideStep = false
    }

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Extract the property key from a path by finding the last string element
   * Walks backwards through the path to skip array indices and find the property name
   *
   * Examples:
   * - ['steps', 0] → 'steps'
   * - ['steps', 0, 'blocks', 0] → 'blocks'
   * - ['value'] → 'value'
   * - [] → undefined
   */
  private getPropertyKeyFromPath(path: (string | number)[]): string | undefined {
    for (let i = path.length - 1; i >= 0; i -= 1) {
      if (typeof path[i] === 'string') {
        return path[i] as string
      }
    }

    return undefined
  }
}
