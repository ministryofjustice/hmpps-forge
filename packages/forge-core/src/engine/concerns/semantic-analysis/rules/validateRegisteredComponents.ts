import { ASTNodeFamily } from '../../../chassis/contracts/ast/enums'
import type { BlockASTNode } from '../../../chassis/contracts/ast/structures.type'
import ForgeUnregisteredComponentError from '../../../errors/ForgeUnregisteredComponentError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { FunctionEntryType } from '../../../../shared/taxonomy'

function buildError(variant: string, diagnostics: ASTNodeDiagnostics | undefined): ForgeUnregisteredComponentError {
  const source = diagnostics?.source

  return new ForgeUnregisteredComponentError({
    formattedPath: source?.formattedPath ?? 'unknown',
    variant,
    callsite: diagnostics?.callsite,
  })
}

export const validateRegisteredComponents: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex, functionRegistry } = context
  const errors: Error[] = []

  nodeIndex.findByFamily<BlockASTNode>(ASTNodeFamily.COMPONENT_CALL).forEach(node => {
    const entryType = functionRegistry.get(node.variant)?._forge

    if (entryType === FunctionEntryType.COMPONENT || entryType === FunctionEntryType.RENDERER) {
      return
    }

    errors.push(buildError(node.variant, node.diagnostics))
  })

  templateNodeIndex.findByFamily(ASTNodeFamily.COMPONENT_CALL).forEach(({ node }) => {
    const variant = (node as unknown as Record<string, unknown>).variant

    if (typeof variant !== 'string') {
      return
    }

    const entryType = functionRegistry.get(variant)?._forge

    if (entryType !== FunctionEntryType.COMPONENT && entryType !== FunctionEntryType.RENDERER) {
      errors.push(buildError(variant, node.diagnostics))
    }
  })

  return errors
}
