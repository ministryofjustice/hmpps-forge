import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { NodeId } from '../../../chassis/contracts/ast/engine.type'
import type { TieBreakerASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: "Tie-breakers can only be used in a step's reachability configuration",
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

export const validateTieBreakerScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType<TieBreakerASTNode>(ExpressionType.TIE_BREAKER).forEach(node => {
    const parent = node.parent

    if (!parent || parent.type !== ASTNodeType.STEP) {
      errors.push(buildError(node.diagnostics))

      return
    }

    if (!containsNode(parent.properties?.reachability?.tieBreakers, node.id)) {
      errors.push(buildError(node.diagnostics))
    }
  })

  templateNodeIndex.findByType(ExpressionType.TIE_BREAKER).forEach(({ node }) => {
    errors.push(buildError(node.diagnostics))
  })

  return errors
}
