import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode, TieBreakerASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { DSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(metadata: DSLSourceMetadata | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: metadata?.dslPath ? [...metadata.dslPath] : [],
    message: "Tie-breakers can only be used in a step's reachability configuration",
    code: 'tiebreaker_outside_step_reachability',
    formattedPath: metadata?.formattedDslPath ?? 'unknown',
  })
}

export const validateTieBreakerScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, nodeTree } = context
  const errors: Error[] = []

  nodeIndex.findByType<TieBreakerASTNode>(ExpressionType.TIE_BREAKER).forEach(node => {
    const parentId = nodeTree.getParent(node.id)

    if (!parentId) {
      errors.push(buildError(getDSLSourceMetadata(node)))

      return
    }

    const parent = nodeIndex.get(parentId)

    if (!parent || parent.type !== ASTNodeType.STEP) {
      errors.push(buildError(getDSLSourceMetadata(node)))
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
