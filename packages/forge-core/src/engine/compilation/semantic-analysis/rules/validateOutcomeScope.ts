import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../diagnostics/sourceLocation.type'
import type { AstNodeId } from '../../../contracts/ast/ast.type'
import getAncestorChain from '../../ast/ast-state/getAncestorChain'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: 'Outcomes can only be used inside a hook (onAccess or onSubmission)',
    code: 'outcome_outside_hook',
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

function hasHookAncestor(context: ASTValidationContext, nodeId: AstNodeId): boolean {
  const ancestors = getAncestorChain(nodeId, context.nodeTree)

  return ancestors.some(ancestorId => {
    const ancestor = context.nodeIndex.get(ancestorId)

    return ancestor?.type === ASTNodeType.HOOK
  })
}

export const validateOutcomeScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.OUTCOME).forEach(node => {
    if (!hasHookAncestor(context, node.id)) {
      errors.push(buildError(node.diagnostics?.source))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const iterateInsideHook = hasHookAncestor(context, iterateNode.id)
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateValue(template, {
        onTemplateNode(templateNode, templateMetadata) {
          if (templateNode.originalType !== ASTNodeType.OUTCOME) {
            return
          }

          if (iterateInsideHook) {
            return
          }

          errors.push(buildError(templateMetadata))
        },
      })
    })
  })

  return errors
}
