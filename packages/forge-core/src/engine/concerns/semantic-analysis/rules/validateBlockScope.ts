import { ASTNodeFamily, astNodeFamily } from '../../../chassis/contracts/ast/enums'
import { FunctionEntryType, StructureType } from '../../../../shared/taxonomy'
import type { MaterialisedASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
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

function buildRendererError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'renderer must use a declaration created with renderer()',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function buildComponentError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Blocks must use a declaration created with component()',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

function isRenderer(container: unknown, nodeId: NodeId): boolean {
  return container !== null && typeof container === 'object' && 'id' in container && container.id === nodeId
}

function entryTypeFor(context: ASTValidationContext, node: MaterialisedASTNode): FunctionEntryType | undefined {
  if (!('variant' in node) || typeof node.variant !== 'string') {
    return undefined
  }

  return context.functionRegistry.get(node.variant)?._forge
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
      if (entryTypeFor(context, node) === FunctionEntryType.RENDERER) {
        errors.push(buildComponentError(node.diagnostics))
      }

      return
    }

    if (parent?.kind === StructureType.STEP && containsNode(parent.properties?.blocks, node.id)) {
      if (entryTypeFor(context, node) === FunctionEntryType.RENDERER) {
        errors.push(buildComponentError(node.diagnostics))
      }

      return
    }

    if (
      (parent?.kind === StructureType.STEP || parent?.kind === StructureType.JOURNEY) &&
      isRenderer(parent.properties?.renderer, node.id)
    ) {
      const entryType = entryTypeFor(context, node)

      if (entryType !== undefined && entryType !== FunctionEntryType.RENDERER) {
        errors.push(buildRendererError(node.diagnostics))
      }

      return
    }

    errors.push(buildError(node.diagnostics))
  })

  return errors
}
