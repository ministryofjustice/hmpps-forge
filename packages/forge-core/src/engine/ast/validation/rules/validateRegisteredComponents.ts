import { ASTNodeType } from '../../../contracts/ast/enums'
import type { BlockASTNode } from '../../../contracts/ast/structures.type'
import UnregisteredComponentError from '../../../errors/UnregisteredComponentError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { ASTValidationContext, ASTValidationRule } from './types'

export const validateRegisteredComponents: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, componentRegistry } = context
  const errors: Error[] = []

  const blockNodes = nodeIndex.findByType<BlockASTNode>(ASTNodeType.BLOCK)

  blockNodes.forEach(node => {
    if (componentRegistry.has(node.variant)) {
      return
    }

    const metadata = getDSLSourceMetadata(node)

    errors.push(
      new UnregisteredComponentError({
        path: metadata?.dslPath ? [...metadata.dslPath] : [],
        formattedPath: metadata?.formattedDslPath,
        variant: node.variant,
      }),
    )
  })

  return errors
}
