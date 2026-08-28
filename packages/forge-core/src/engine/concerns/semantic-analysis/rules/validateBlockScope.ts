import { ASTNodeFamily, astNodeFamily } from '../../../chassis/contracts/ast/enums'
import { StructureType } from '../../../../shared/taxonomy'
import type { NodeId } from '../../../chassis/contracts/ast/engine.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Blocks can only be defined in a step blocks array or nested within another block',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

export const validateBlockScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByFamily(ASTNodeFamily.COMPONENT_CALL).forEach(node => {
    const parent = node.parent

    // Composite component wrappers legitimately hold child blocks in arbitrary
    // properties (slots, content, rows, columns); those child blocks parent to
    // the wrapper block, so any block-parented block is in scope.
    if (parent && astNodeFamily(parent.kind) === ASTNodeFamily.COMPONENT_CALL) {
      return
    }

    if (parent?.kind === StructureType.STEP && containsNode(parent.properties?.blocks, node.id)) {
      return
    }

    errors.push(buildError(node.diagnostics))
  })

  return errors
}
