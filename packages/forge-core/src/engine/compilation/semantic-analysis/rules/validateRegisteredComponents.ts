import { ASTNodeType } from '../../../contracts/ast/enums'
import type { BlockASTNode } from '../../../contracts/ast/structures.type'
import UnregisteredComponentError from '../../../errors/UnregisteredComponentError'
import type { ASTValidationContext, ASTValidationRule } from './types'

export const validateRegisteredComponents: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, componentRegistry } = context
  const errors: Error[] = []

  const blockNodes = nodeIndex.findByType<BlockASTNode>(ASTNodeType.BLOCK)

  blockNodes.forEach(node => {
    if (componentRegistry.has(node.variant)) {
      return
    }

    const source = node.diagnostics?.source

    errors.push(
      new UnregisteredComponentError({
        path: source?.path ? [...source.path] : [],
        formattedPath: source?.formattedPath ?? 'unknown',
        variant: node.variant,
      }),
    )
  })

  return errors
}
