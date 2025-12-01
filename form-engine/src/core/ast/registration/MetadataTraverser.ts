import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
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

  private targetStepId: NodeId | null = null

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
   * Traverse a runtime node subtree, setting metadata for the node and its descendants
   * Used for dynamically created nodes that need parent context from compile-time nodes
   *
   * Reads parent relationship from metadata (set by handlers) and reconstructs
   * ancestorPath so enterNode() can handle metadata setting automatically
   *
   * @param runtimeNode The runtime node to traverse
   */
  traverseSubtree(runtimeNode: ASTNode): void {
    // Read parent relationship from metadata (set by handler when node was created)
    const parentNodeId = this.metadataRegistry.get<NodeId>(runtimeNode.id, 'attachedToParentNode')

    if (!parentNodeId) {
      // No parent metadata - can't traverse without parent context
      return
    }

    // Mark if we're inside the step if the parent was inside the step
    this.insideStep = this.metadataRegistry.get(parentNodeId, 'isDescendantOfStep')
    this.targetStepId = null

    // Reconstruct ancestorPath from metadata by walking up the parent chain
    // Creates shallow node objects with just the id property (that's all enterNode needs)
    this.ancestorPath = []
    let currentId = parentNodeId

    while (currentId) {
      // Create shallow node object - enterNode only accesses the id property
      this.ancestorPath.unshift({ id: currentId } as ASTNode)
      currentId = this.metadataRegistry.get<NodeId>(currentId, 'attachedToParentNode')
    }

    // Traverse the runtime node - enterNode() will handle all other metadata setting automatically
    structuralTraverse(runtimeNode, this)
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

      // Mark this step node as isAncestorOfStep and isCurrentStep
      this.metadataRegistry.set(node.id, 'isAncestorOfStep', true)
      this.metadataRegistry.set(node.id, 'isCurrentStep', true)

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
