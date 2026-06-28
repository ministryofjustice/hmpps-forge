import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: 'Hooks can only be used on steps (onAccess, onSubmission) or journeys (onAccess)',
    code: 'hook_outside_step_or_journey',
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

export const validateHookScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, nodeTree } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.HOOK).forEach(node => {
    const parentId = nodeTree.getParent(node.id)

    if (!parentId) {
      errors.push(buildError(node.diagnostics?.source))

      return
    }

    const parent = nodeIndex.get(parentId)

    if (!parent || (parent.type !== ASTNodeType.JOURNEY && parent.type !== ASTNodeType.STEP)) {
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
