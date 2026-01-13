import { ASTNode } from '@form-engine/core/types/engine.type'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import {
  structuralTraverse,
  StructuralVisitor,
  StructuralVisitResult,
  StructuralContext,
} from '@form-engine/core/compilation/traversers/StructuralTraverser'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'

/**
 * Visitor that builds a registry from an AST by collecting all nodes with their IDs.
 * Uses StructuralTraverser to traverse the AST and register each node using its existing ID.
 */
export default class RegistrationTraverser implements StructuralVisitor {
  constructor(private readonly registry: NodeRegistry) {}

  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode, ctx: StructuralContext): StructuralVisitResult {
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
  }

  /**
   * Register all nodes in the AST
   * @param root The root node of the AST to register
   * @throws Error if any node lacks an ID
   */
  register(root: ASTNode): void {
    structuralTraverse(root, this)
  }
}
