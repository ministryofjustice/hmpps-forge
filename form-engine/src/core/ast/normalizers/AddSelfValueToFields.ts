import { ASTNode } from '@form-engine/core/types/engine.type'
import { structuralTraverse, StructuralVisitResult } from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'

/**
 * Normalizer that adds Self() as the value for field blocks.
 * This ensures fields automatically display their answer value without needing explicit configuration.
 */
export function addSelfValueToFields(root: ASTNode): void {
  structuralTraverse(root, {
    enterNode: node => {
      // Only process field blocks
      if (!isBlockStructNode(node) || node.blockType !== 'field') {
        return StructuralVisitResult.CONTINUE
      }

      if (!node.properties) {
        return StructuralVisitResult.CONTINUE
      }

      // Only process blocks that have a 'code' (i.e., fields)
      const code = node.properties.get('code')
      if (!code) {
        return StructuralVisitResult.CONTINUE
      }

      // Create a Self() reference node
      const selfReference: ReferenceASTNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.REFERENCE,
        properties: new Map([['path', ['answers', '@self']]]),
        raw: {
          type: ExpressionType.REFERENCE,
          path: ['answers', '@self'],
        },
      }

      // Add the Self() reference as the value directly on the node
      node.properties.set('value', selfReference)

      return StructuralVisitResult.CONTINUE
    },
  })
}
