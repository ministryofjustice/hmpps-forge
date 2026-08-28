import { FunctionCallType } from '../../../../shared/taxonomy'
import { ASTNodeFamily, astNodeFamily } from '../../../chassis/contracts/ast/enums'
import type { FunctionASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(name: string, diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: `Effect "${name}" can only be used inside a hook (onAccess or onSubmission)`,
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function hasHookAncestor(node: ASTNode): boolean {
  let current = node.parent

  while (current !== undefined) {
    if (astNodeFamily(current.kind) === ASTNodeFamily.HOOK) {
      return true
    }

    current = current.parent
  }

  return false
}

export const validateEffectScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex } = context
  const errors: Error[] = []

  const effectNodes = nodeIndex.findByKind<FunctionASTNode>(FunctionCallType.EFFECT)

  effectNodes.forEach(node => {
    if (!hasHookAncestor(node)) {
      errors.push(buildError(node.properties.name, node.diagnostics))
    }
  })

  templateNodeIndex.findByKind(FunctionCallType.EFFECT).forEach(({ node, owningNode }) => {
    if (hasHookAncestor(owningNode)) {
      return
    }

    const name = (node.properties?.name as string) ?? ''

    errors.push(buildError(name, node.diagnostics))
  })

  return errors
}
