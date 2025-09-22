import { ASTNode } from '@form-engine/core/types/engine.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import {
  structuralTraverse,
  StructuralVisitor,
  StructuralVisitResult,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'

/**
 * Traverser that assigns unique IDs to all AST nodes and builds a registry.
 * Uses StructuralTraverser to traverse the AST and assign sequential numeric
 * IDs to each node. Each node receives an ID in its id field and is registered
 * in a NodeRegistry for O(1) lookups with their structural paths.
 */
export default class RegistrationTraverser {
  private counter: number = 0

  private readonly registry: NodeRegistry = new NodeRegistry()

  private constructor() {}

  /**
   * Static factory method to create and execute registration traversal
   * @param root The root node of the AST to register
   * @returns NodeRegistry containing all nodes with assigned IDs and paths
   */
  static buildRegistry(root: ASTNode): NodeRegistry {
    const traverser = new RegistrationTraverser()
    return traverser.traverse(root)
  }

  /**
   * Traverse an AST, assign IDs to all nodes, and return a registry
   * @param root The root node of the AST
   * @returns NodeRegistry containing all nodes with assigned IDs
   */
  private traverse(root: ASTNode): NodeRegistry {
    // Create visitor that only processes nodes
    const visitor: StructuralVisitor = {
      enterNode: (node: ASTNode, ctx: StructuralContext) => {
        // Generate and assign ID
        const id = this.generateId()

        // eslint-disable-next-line no-param-reassign
        node.id = id

        // Register node in registry with its structural path
        this.registry.register(id, node, [...ctx.path])

        // Continue traversal
        return StructuralVisitResult.CONTINUE
      },
    }

    // Traverse the tree
    structuralTraverse(root, visitor)

    // Return the populated registry
    return this.registry
  }

  /**
   * Generate a unique numeric ID
   * @returns A unique ID number
   */
  private generateId(): number {
    this.counter += 1
    return this.counter
  }
}
