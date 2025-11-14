import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isValidationExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { isFieldBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { cloneASTValue } from '@form-engine/core/ast/utils/cloneASTValue'

/**
 * Normalizer that records the owning block's code on validation expressions.
 * Allows runtime validation handlers to avoid walking back up the AST.
 */
export class AttachValidationBlockCodeNormalizer implements StructuralVisitor {
  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode, ctx: StructuralContext): StructuralVisitResult {
    if (!isValidationExprNode(node)) {
      return StructuralVisitResult.CONTINUE
    }

    const owningBlock = findOwningBlock(ctx.ancestors)

    if (!owningBlock) {
      return StructuralVisitResult.CONTINUE
    }

    const resolvedCode = resolveBlockCode(owningBlock)

    if (resolvedCode === undefined) {
      delete node.properties.resolvedBlockCode
    } else {
      node.properties.resolvedBlockCode = resolvedCode
    }

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Normalize the AST by attaching validation block codes
   */
  normalize(root: ASTNode): void {
    structuralTraverse(root, this)
  }
}

function findOwningBlock(ancestors: any[]): FieldBlockASTNode | undefined {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const candidate = ancestors[i]

    if (isFieldBlockStructNode(candidate)) {
      return candidate
    }
  }

  return undefined
}

function resolveBlockCode(block: FieldBlockASTNode): string | ASTNode | undefined {
  const code = block.properties.code

  return cloneASTValue(code)
}
