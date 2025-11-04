import { ASTNode } from '@form-engine/core/types/engine.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import {
  structuralTraverse,
  StructuralVisitor,
  StructuralVisitResult,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'

/**
 * Traverser that builds a registry from an AST by collecting all nodes with their IDs.
 * Uses StructuralTraverser to traverse the AST and register each node using its existing ID.
 */
export default class RegistrationTraverser {
  private readonly registry: NodeRegistry = new NodeRegistry()

  private constructor() {}

  /**
   * Static factory method to create and execute registration traversal
   * @param root The root node of the AST to register
   * @returns NodeRegistry containing all nodes with their IDs and paths
   * @throws Error if any node lacks an ID
   */
  static buildRegistry(root: ASTNode): NodeRegistry {
    const traverser = new RegistrationTraverser()
    return traverser.traverse(root)
  }

  /**
   * Traverse an AST and register all nodes with their existing IDs
   * @param root The root node of the AST
   * @returns NodeRegistry containing all nodes
   * @throws Error if any node lacks an ID
   */
  private traverse(root: ASTNode): NodeRegistry {
    // Create visitor that only processes nodes
    const visitor: StructuralVisitor = {
      enterNode: (node: ASTNode, ctx: StructuralContext) => {
        // Nodes must have IDs already assigned
        if (!node.id) {
          throw new InvalidNodeError({
            message: `Node is missing ID - ${ctx.path.join('.')}`,
            node,
          })
        }

        this.registry.register(node.id, node, [...ctx.path])

        // Continue traversal
        return StructuralVisitResult.CONTINUE
      },
    }

    // Traverse the tree
    structuralTraverse(root, visitor)

    // Return the populated registry
    return this.registry
  }
}
