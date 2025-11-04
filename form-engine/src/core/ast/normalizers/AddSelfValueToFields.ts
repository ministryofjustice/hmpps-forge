import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ReferenceExpr } from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'

/**
 * Normalizer that adds Self() as the value for field blocks.
 * This ensures fields automatically display their answer value without needing explicit configuration.
 */
export class AddSelfValueToFieldsNormalizer implements StructuralVisitor {
  constructor(private readonly nodeFactory: NodeFactory) {}

  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode): StructuralVisitResult {
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

    // Create a Self() reference node using the factory
    const selfReference = this.nodeFactory.createNode({
      type: ExpressionType.REFERENCE,
      path: ['answers', '@self'],
    } satisfies ReferenceExpr)

    // Add the Self() reference as the value directly on the node
    node.properties.set('value', selfReference)

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Normalize the AST by adding Self() references to field blocks
   */
  normalize(root: ASTNode): void {
    structuralTraverse(root, this)
  }
}
