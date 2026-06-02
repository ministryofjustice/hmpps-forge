import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { DSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(metadata: DSLSourceMetadata | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: metadata?.dslPath ? [...metadata.dslPath] : [],
    message: 'Hooks can only be used on steps (onAccess, onSubmission) or journeys (onAccess)',
    code: 'hook_outside_step_or_journey',
    formattedPath: metadata?.formattedDslPath ?? 'unknown',
  })
}

export const validateHookScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, nodeTree } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.HOOK).forEach(node => {
    const parentId = nodeTree.getParent(node.id)

    if (!parentId) {
      errors.push(buildError(getDSLSourceMetadata(node)))

      return
    }

    const parent = nodeIndex.get(parentId)

    if (!parent || (parent.type !== ASTNodeType.JOURNEY && parent.type !== ASTNodeType.STEP)) {
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
          if (templateNode.originalType !== ASTNodeType.HOOK) {
            return
          }

          errors.push(buildError(templateMetadata))
        },
      })
    })
  })

  return errors
}
