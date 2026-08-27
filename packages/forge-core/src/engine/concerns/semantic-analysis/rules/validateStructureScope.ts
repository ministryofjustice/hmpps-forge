import { StructureType } from '../../../../authoring/types/enums'
import type { AstNodeId } from '../../../chassis/contracts/ast/engine.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildStepError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Steps can only be defined in a journey steps array',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function buildJourneyError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Journeys can only be defined at the root or in a journey children array',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function containsNode(entries: unknown, nodeId: AstNodeId): boolean {
  return Array.isArray(entries) && entries.some(entry => entry?.id === nodeId)
}

export const validateStructureScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByKind(StructureType.STEP).forEach(node => {
    const parent = node.parent

    if (!parent || parent.kind !== StructureType.JOURNEY || !containsNode(parent.properties?.steps, node.id)) {
      errors.push(buildStepError(node.diagnostics))
    }
  })

  nodeIndex.findByKind(StructureType.JOURNEY).forEach(node => {
    const parent = node.parent

    if (!parent) {
      return
    }

    if (parent.kind !== StructureType.JOURNEY || !containsNode(parent.properties?.children, node.id)) {
      errors.push(buildJourneyError(node.diagnostics))
    }
  })

  templateNodeIndex.findByKind(StructureType.STEP).forEach(({ node }) => {
    errors.push(buildStepError(node.diagnostics))
  })

  templateNodeIndex.findByKind(StructureType.JOURNEY).forEach(({ node }) => {
    errors.push(buildJourneyError(node.diagnostics))
  })

  return errors
}
