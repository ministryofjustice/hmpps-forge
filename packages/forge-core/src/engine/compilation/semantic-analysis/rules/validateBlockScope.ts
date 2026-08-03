import { ASTNodeType } from '../../../contracts/ast/enums'
import type { NodeId } from '../../../contracts/ast/engine.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: 'Blocks can only be defined in a step blocks array or nested within another block',
    code: 'block_outside_blocks',
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

export const validateBlockScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.BLOCK).forEach(node => {
    const parent = node.parent

    // Composite component wrappers legitimately hold child blocks in arbitrary
    // properties (slots, content, rows, columns); those child blocks parent to
    // the wrapper block, so any block-parented block is in scope.
    if (parent?.type === ASTNodeType.BLOCK) {
      return
    }

    if (parent?.type === ASTNodeType.STEP && containsNode(parent.properties?.blocks, node.id)) {
      return
    }

    errors.push(buildError(node.diagnostics?.source))
  })

  return errors
}
