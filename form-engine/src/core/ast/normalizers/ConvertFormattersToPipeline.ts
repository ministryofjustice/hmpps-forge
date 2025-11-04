import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { ExpressionType } from '@form-engine/form/types/enums'
import { PipelineASTNode, ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'

/**
 * Converts field formatters arrays into Pipeline expressions during normalization.
 *
 * This transformation ensures that formatters are treated as regular expression
 * nodes by the runtime, allowing the dependency graph to track their dependencies
 * and the evaluation engine to handle them consistently.
 *
 * For each field with formatters:
 * 1. Creates a Pipeline expression with Reference(['post', fieldCode]) as input
 * 2. Converts each formatter function to a pipeline step
 * 3. Stores the pipeline as the formatPipeline property
 */
export class ConvertFormattersToPipelineNormalizer implements StructuralVisitor {
  constructor(private readonly nodeIDGenerator: NodeIDGenerator) {}

  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode, ctx: StructuralContext): StructuralVisitResult {
    // Only process field blocks
    if (!isBlockStructNode(node) || node.blockType !== 'field') {
      return StructuralVisitResult.CONTINUE
    }

    if (!node.properties) {
      return StructuralVisitResult.CONTINUE
    }

    // Check if field has formatters
    const formatters = node.properties.get('formatters')

    if (!Array.isArray(formatters) || formatters.length === 0) {
      return StructuralVisitResult.CONTINUE
    }

    // Get field code for POST reference
    const fieldCode = node.properties.get('code')

    if (!fieldCode) {
      throw new InvalidNodeError({
        message: 'Field with formatters must have a code property',
        node,
        path: ctx.path,
      })
    }

    // Create the POST reference node manually to preserve fieldCode (which may be an AST node)
    // The code can be either a string or an expression (e.g., Format('address_%1', Item.index()))
    const postReference: ReferenceASTNode = {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.REFERENCE,
      properties: new Map([['path', ['post', fieldCode]]]),
    }

    // Create the pipeline node manually with proper ID
    const pipelineNode: PipelineASTNode = {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.PIPELINE,
      properties: new Map<string, any>([
        ['input', postReference],
        ['steps', formatters],
      ]),
    }

    // Store the pipeline as formatPipeline property, remove old field
    node.properties.set('formatPipeline', pipelineNode)
    node.properties.delete('formatters')

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Normalize the AST by converting formatters to pipeline expressions
   */
  normalize(root: ASTNode): void {
    structuralTraverse(root, this)
  }
}
