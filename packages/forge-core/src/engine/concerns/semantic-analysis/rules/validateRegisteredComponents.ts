import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { BlockASTNode } from '../../../chassis/contracts/ast/structures.type'
import ForgeUnregisteredComponentError from '../../../errors/ForgeUnregisteredComponentError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildError(variant: string, diagnostics: ASTNodeDiagnostics | undefined): ForgeUnregisteredComponentError {
  const source = diagnostics?.source

  return new ForgeUnregisteredComponentError({
    formattedPath: source?.formattedPath ?? 'unknown',
    variant,
    callsite: diagnostics?.callsite,
  })
}

export const validateRegisteredComponents: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, componentRegistry } = context
  const errors: Error[] = []

  const blockNodes = nodeIndex.findByType<BlockASTNode>(ASTNodeType.BLOCK)

  blockNodes.forEach(node => {
    if (componentRegistry.has(node.variant)) {
      return
    }

    errors.push(buildError(node.variant, node.diagnostics))
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateValue(template, {
        onTemplateNode(templateNode, templateMetadata) {
          if (templateNode.originalType !== ASTNodeType.BLOCK) {
            return
          }

          const variant = (templateNode as Record<string, unknown>).variant

          if (typeof variant !== 'string') {
            return
          }

          if (!componentRegistry.has(variant)) {
            errors.push(buildError(variant, templateMetadata))
          }
        },
      })
    })
  })

  return errors
}
