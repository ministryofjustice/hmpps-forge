import { FunctionType, ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { FunctionASTNode, IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(name: string, diagnostics: ASTNodeDiagnostics | undefined): ForgeConfigurationReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: `Effect "${name}" can only be used inside a hook (onAccess or onSubmission)`,
    code: 'effect_outside_hook',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function hasHookAncestor(node: ASTNode): boolean {
  let current = node.parent

  while (current !== undefined) {
    if (current.type === ASTNodeType.HOOK) {
      return true
    }

    current = current.parent
  }

  return false
}

export const validateEffectScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  const effectNodes = nodeIndex.findByType<FunctionASTNode>(FunctionType.EFFECT)

  effectNodes.forEach(node => {
    if (!hasHookAncestor(node)) {
      errors.push(buildError(node.properties.name, node.diagnostics))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const iterateInsideHook = hasHookAncestor(iterateNode)
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
