import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type { IterateASTNode, TieBreakerASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: "Tie-breakers can only be used in a step's reachability configuration",
    code: 'tiebreaker_outside_step_reachability',
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

export const validateTieBreakerScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType<TieBreakerASTNode>(ExpressionType.TIE_BREAKER).forEach(node => {
    const parent = node.parent

    if (!parent || parent.type !== ASTNodeType.STEP) {
      errors.push(buildError(node.diagnostics?.source))

      return
    }

    if (!containsNode(parent.properties?.reachability?.tieBreakers, node.id)) {
      errors.push(buildError(node.diagnostics?.source))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateValue(template, {
        onTemplateNode(templateNode, templateMetadata) {
          if (templateNode.originalType !== ASTNodeType.EXPRESSION) {
            return
          }

          const expressionType = (templateNode as Record<string, unknown>).expressionType as string | undefined

          if (expressionType !== ExpressionType.TIE_BREAKER) {
            return
          }

          errors.push(buildError(templateMetadata))
        },
      })
    })
  })

  return errors
}
