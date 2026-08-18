import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { NodeId, ASTNode } from '../../../chassis/contracts/ast/engine.type'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

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
  const { nodeIndex } = context
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

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const iterateInsideHook = hasHookAncestor(iterateNode)
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateValue(template, {
        onTemplateNode(templateNode, templateMetadata) {
          if (templateNode.originalType !== ASTNodeType.OUTCOME) {
            return
          }

          if (iterateInsideHook) {
            return
          }

          errors.push(buildError(templateMetadata))
        },
      })
    })
  })

  return errors
}
