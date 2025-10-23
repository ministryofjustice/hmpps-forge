import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
} from '@form-engine/core/ast/traverser/StructuralTraverser'

/**
 * Mutates AST nodes to include a reference to their parent node.
 */
export function attachParentNodes(root: ASTNode): void {
  const parentStack: ASTNode[] = []

  const visitor: StructuralVisitor = {
    enterNode: (node: ASTNode): StructuralVisitResult => {
      const parent = parentStack[parentStack.length - 1]

      if (parent) {
        node.parentNode = parent
      } else if (node.parentNode !== undefined) {
        delete node.parentNode
      }

      parentStack.push(node)

      return StructuralVisitResult.CONTINUE
    },
    exitNode: (): StructuralVisitResult => {
      parentStack.pop()
      return StructuralVisitResult.CONTINUE
    },
  }

  structuralTraverse(root, visitor)
}
