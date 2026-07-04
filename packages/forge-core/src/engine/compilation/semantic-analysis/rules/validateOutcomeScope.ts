import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../diagnostics/sourceLocation.type'
import type { AstNodeId } from '../../../contracts/ast/ast.type'
import getAncestorChain from '../../ast/ast-state/getAncestorChain'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: 'Outcomes can only be used inside a hook (onAccess or onSubmission)',
    code: 'outcome_outside_hook',
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

function containsNode(container: unknown, nodeId: NodeId): boolean {
  return Array.isArray(container) && container.some(entry => entry?.id === nodeId)
}

function hasHookAncestor(context: ASTValidationContext, nodeId: AstNodeId): boolean {
  const ancestors = getAncestorChain(nodeId, context.nodeTree)

  return ancestors.some(ancestorId => {
    const ancestor = context.nodeIndex.get(ancestorId)

    return ancestor?.type === ASTNodeType.HOOK
  })
}

export const validateOutcomeScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, nodeTree } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.OUTCOME).forEach(node => {
    const parentId = nodeTree.getParent(node.id)

    if (!parentId) {
      errors.push(buildError(node.diagnostics?.source))

      return
    }

    const parent = nodeIndex.get(parentId)

    if (!parent || parent.type !== ASTNodeType.HOOK) {
      errors.push(buildError(node.diagnostics?.source))

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
      errors.push(buildError(node.diagnostics?.source))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const iterateInsideHook = hasHookAncestor(context, iterateNode.id)
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
