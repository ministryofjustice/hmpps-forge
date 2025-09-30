import { ASTNode } from '@form-engine/core/types/engine.type'
import { structuralTraverse, StructuralVisitResult } from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { PipelineASTNode, ReferenceASTNode } from '@form-engine/core/types/expressions.type'

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
export function convertFormattersToPipeline(root: ASTNode): void {
  structuralTraverse(root, {
    enterNode: (node, ctx) => {
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

      // Create the POST reference node
      // The code can be either a string or an expression (e.g., Format('address_%1', Item.index()))
      const postReference: ReferenceASTNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.REFERENCE,
        properties: new Map([['path', ['post', fieldCode]]]),
      }

      const pipelineSteps = formatters.map(formatter => {
        const properties = new Map(formatter.properties ?? [])
        const args = properties.get('arguments')

        properties.set('arguments', Array.isArray(args) ? [...args] : [])

        return {
          ...formatter,
          properties,
        }
      })

      // Create the pipeline node with normalized formatter steps
      const pipelineNode: PipelineASTNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.PIPELINE,
        properties: new Map<string, any>([
          ['input', postReference],
          ['steps', pipelineSteps],
        ]),
      }

      // Store the pipeline as formatPipeline property
      node.properties.set('formatPipeline', pipelineNode)

      return StructuralVisitResult.CONTINUE
    },
  })
}
