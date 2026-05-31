import { FunctionType, ExpressionType, HookType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { FunctionASTNode, IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { DSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import getAncestorChain from '../../ast-state/getAncestorChain'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(name: string, metadata: DSLSourceMetadata | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: metadata?.dslPath ? [...metadata.dslPath] : [],
    message: `Effect "${name}" can only be used inside a hook (onAccess or onSubmission)`,
    code: 'effect_outside_hook',
    formattedPath: metadata?.formattedDslPath ?? 'unknown',
  })
}

function hasHookAncestor(context: ASTValidationContext, nodeId: string): boolean {
  const ancestors = getAncestorChain(nodeId as Parameters<typeof getAncestorChain>[0], context.nodeTree)

  return ancestors.some(ancestorId => {
    const ancestor = context.nodeIndex.get(ancestorId)

    return ancestor?.type === ASTNodeType.HOOK
  })
}

function hasHookAncestorViaIterateChain(context: ASTValidationContext, iterateNodeId: string): boolean {
  return hasHookAncestor(context, iterateNodeId)
}

export const validateEffectScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  const effectNodes = nodeIndex.findByType<FunctionASTNode>(FunctionType.EFFECT)

  effectNodes.forEach(node => {
    if (!hasHookAncestor(context, node.id)) {
      errors.push(buildError(node.properties.name, getDSLSourceMetadata(node)))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const iterateInsideHook = hasHookAncestorViaIterateChain(context, iterateNode.id)
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

          if (expressionType !== FunctionType.EFFECT) {
            return
          }

          if (iterateInsideHook) {
            return
          }

          const name = (templateNode.properties?.name as string) ?? ''

          errors.push(buildError(name, templateMetadata))
        },
      })
    })
  })

  return errors
}
