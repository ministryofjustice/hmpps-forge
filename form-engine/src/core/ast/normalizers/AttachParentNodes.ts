import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
} from '@form-engine/core/ast/traverser/StructuralTraverser'

/**
 * Normalizer that mutates AST nodes to include a reference to their parent node.
 */
export class AttachParentNodesNormalizer implements StructuralVisitor {
  private parentStack: ASTNode[] = []

  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode): StructuralVisitResult {
    const parent = this.parentStack[this.parentStack.length - 1]

    if (parent) {
      node.parentNode = parent
    } else if (node.parentNode !== undefined) {
      delete node.parentNode
    }

    this.parentStack.push(node)

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Visitor method: called when exiting a node during traversal
   */
  exitNode(): StructuralVisitResult {
    this.parentStack.pop()
    return StructuralVisitResult.CONTINUE
  }

  /**
   * Normalize the AST by attaching parent node references
   */
  normalize(root: ASTNode): void {
    this.parentStack = []
    structuralTraverse(root, this)
  }
}
