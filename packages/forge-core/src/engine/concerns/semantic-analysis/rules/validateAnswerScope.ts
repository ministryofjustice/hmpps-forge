import { ExpressionType, HookType } from '../../../../shared/taxonomy'
import { ASTNodeFamily, astNodeFamily } from '../../../chassis/contracts/ast/enums'
import type { ReferenceASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Answer() cannot be used in an onAccess hook: answer preparation runs after access hooks',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

/** `@self` answer references are validateSelfScope's case — a hook is already outside every field block. */
function isAnswerReferencePath(path: unknown): boolean {
  if (!Array.isArray(path)) {
    return false
  }

  return path[0] === 'answers' && path[1] !== '@self'
}

function hasAccessHookAncestor(node: ASTNode): boolean {
  let current = node.parent

  while (current !== undefined) {
    if (astNodeFamily(current.kind) === ASTNodeFamily.HOOK) {
      return current.kind === HookType.ACCESS
    }

    current = current.parent
  }

  return false
}

export const validateAnswerScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByKind<ReferenceASTNode>(ExpressionType.REFERENCE).forEach(node => {
    if (isAnswerReferencePath(node.properties?.path) && hasAccessHookAncestor(node)) {
      errors.push(buildError(node.diagnostics))
    }
  })

  templateNodeIndex.findByKind(ExpressionType.REFERENCE).forEach(({ node, owningNode }) => {
    if (isAnswerReferencePath(node.properties?.path) && hasAccessHookAncestor(owningNode)) {
      errors.push(buildError(node.diagnostics))
    }
  })

  return errors
}
