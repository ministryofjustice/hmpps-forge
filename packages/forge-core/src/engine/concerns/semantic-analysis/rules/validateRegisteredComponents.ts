import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { BlockASTNode } from '../../../chassis/contracts/ast/structures.type'
import ForgeUnregisteredComponentError from '../../../errors/ForgeUnregisteredComponentError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(variant: string, diagnostics: ASTNodeDiagnostics | undefined): ForgeUnregisteredComponentError {
  const source = diagnostics?.source

  return new ForgeUnregisteredComponentError({
    formattedPath: source?.formattedPath ?? 'unknown',
    variant,
    callsite: diagnostics?.callsite,
  })
}

export const validateRegisteredComponents: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex, componentRegistry } = context
  const errors: Error[] = []

  nodeIndex.findByType<BlockASTNode>(ASTNodeType.BLOCK).forEach(node => {
    if (componentRegistry.has(node.variant)) {
      return
    }

    errors.push(buildError(node.variant, node.diagnostics))
  })

  templateNodeIndex.findByType(ASTNodeType.BLOCK).forEach(({ node }) => {
    const variant = node.variant

    if (typeof variant !== 'string') {
      return
    }

    if (!componentRegistry.has(variant)) {
      errors.push(buildError(variant, node.diagnostics))
    }
  })

  return errors
}
