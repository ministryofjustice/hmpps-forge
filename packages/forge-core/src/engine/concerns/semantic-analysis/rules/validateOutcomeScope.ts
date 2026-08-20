import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { NodeId, ASTNode } from '../../../chassis/contracts/ast/engine.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Outcomes can only be used inside a hook (onAccess or onSubmission)',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

function hasHookAncestor(node: ASTNode): boolean {
  let current = node.parent

  while (current !== undefined) {
    if (current.type === ASTNodeType.HOOK) {
      return true
    }

    current = current.parent
  }

  return false
}

export const validateOutcomeScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.OUTCOME).forEach(node => {
    const parent = node.parent

    if (!parent || parent.type !== ASTNodeType.HOOK) {
      errors.push(buildError(node.diagnostics))

      return
    }

    // Access hooks carry outcomes in `next`; submit hooks split them across the
    // onAlways/onValid/onInvalid branch objects, which are plain objects and so
    // parent their outcomes to the hook itself.
    const inHookNext =
      containsNode(parent.properties?.next, node.id) ||
      containsNode(parent.properties?.onAlways?.next, node.id) ||
      containsNode(parent.properties?.onValid?.next, node.id) ||
      containsNode(parent.properties?.onInvalid?.next, node.id)

    if (!inHookNext) {
      errors.push(buildError(node.diagnostics))
    }
  })

  templateNodeIndex.findByType(ASTNodeType.OUTCOME).forEach(({ node, owningNode }) => {
    if (hasHookAncestor(owningNode)) {
      return
    }

    errors.push(buildError(node.diagnostics))
  })

  return errors
}
