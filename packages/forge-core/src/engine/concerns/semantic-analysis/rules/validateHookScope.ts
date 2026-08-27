import { ASTNodeFamily } from '../../../chassis/contracts/ast/enums'
import { StructureType } from '../../../../authoring/types/enums'
import type { NodeId } from '../../../chassis/contracts/ast/engine.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Hooks can only be defined in onAccess (steps, journeys) or onSubmission (steps) arrays',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

export const validateHookScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByFamily(ASTNodeFamily.HOOK).forEach(node => {
    const parent = node.parent

    if (!parent || (parent.kind !== StructureType.JOURNEY && parent.kind !== StructureType.STEP)) {
      errors.push(buildError(node.diagnostics))

      return
    }

    const inAccess = containsNode(parent.properties?.onAccess, node.id)
    const inSubmission = parent.kind === StructureType.STEP && containsNode(parent.properties?.onSubmission, node.id)

    if (!inAccess && !inSubmission) {
      errors.push(buildError(node.diagnostics))
    }
  })

  templateNodeIndex.findByFamily(ASTNodeFamily.HOOK).forEach(({ node }) => {
    errors.push(buildError(node.diagnostics))
  })

  return errors
}
