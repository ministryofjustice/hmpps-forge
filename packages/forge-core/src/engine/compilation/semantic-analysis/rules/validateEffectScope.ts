import { FunctionType, ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { FunctionASTNode, IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../diagnostics/sourceLocation.type'
import type { AstNodeId } from '../../../contracts/ast/ast.type'
import getAncestorChain from '../../ast/ast-state/getAncestorChain'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(name: string, source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: `Effect "${name}" can only be used inside a hook (onAccess or onSubmission)`,
    code: 'effect_outside_hook',
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

function hasHookAncestorViaIterateChain(context: ASTValidationContext, iterateNodeId: AstNodeId): boolean {
  return hasHookAncestor(context, iterateNodeId)
}

export const validateEffectScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  const effectNodes = nodeIndex.findByType<FunctionASTNode>(FunctionType.EFFECT)

  effectNodes.forEach(node => {
    if (!hasHookAncestor(context, node.id)) {
      errors.push(buildError(node.properties.name, node.diagnostics?.source))
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
