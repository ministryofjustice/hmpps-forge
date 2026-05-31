import { FunctionType, ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { FunctionASTNode, IterateASTNode } from '../../../contracts/ast/expressions.type'
import UnregisteredFunctionError from '../../../errors/UnregisteredFunctionError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

const FUNCTION_TYPES = Object.values(FunctionType)

function buildError(
  name: string,
  functionType: string,
  metadata: { dslPath?: readonly (string | number)[]; formattedDslPath?: string },
): UnregisteredFunctionError {
  return new UnregisteredFunctionError({
    path: metadata.dslPath ? [...metadata.dslPath] : [],
    formattedPath: metadata.formattedDslPath,
    functionName: name,
    functionType,
  })
}

export const validateRegisteredFunctions: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, functionRegistry } = context
  const errors: Error[] = []

  FUNCTION_TYPES.forEach(functionType => {
    const functionNodes = nodeIndex.findByType<FunctionASTNode>(functionType)

    functionNodes.forEach(node => {
      if (!functionRegistry.has(node.properties.name)) {
        const metadata = getDSLSourceMetadata(node)

        errors.push(
          buildError(node.properties.name, functionType, {
            dslPath: metadata?.dslPath,
            formattedDslPath: metadata?.formattedDslPath,
          }),
        )
      }
    })
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
          if (templateNode.originalType !== ASTNodeType.EXPRESSION) {
            return
          }

          const expressionType = (templateNode as Record<string, unknown>).expressionType as string | undefined

          if (!expressionType || !FUNCTION_TYPES.includes(expressionType as FunctionType)) {
            return
          }

          const name = (templateNode.properties?.name as string) ?? ''

          if (!functionRegistry.has(name)) {
            errors.push(
              buildError(name, expressionType, {
                dslPath: templateMetadata?.dslPath,
                formattedDslPath: templateMetadata?.formattedDslPath,
              }),
            )
          }
        },
      })
    })
  })

  return errors
}
