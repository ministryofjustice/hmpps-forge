import { FunctionType, ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { FunctionASTNode, IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ForgeUnregisteredFunctionError from '../../../errors/ForgeUnregisteredFunctionError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

const FUNCTION_TYPES = Object.values(FunctionType)

function buildError(
  name: string,
  functionType: string,
  diagnostics: ASTNodeDiagnostics | undefined,
): ForgeUnregisteredFunctionError {
  const source = diagnostics?.source

  return new ForgeUnregisteredFunctionError({
    formattedPath: source?.formattedPath ?? 'unknown',
    functionName: name,
    functionType,
    callsite: diagnostics?.callsite,
  })
}

export const validateRegisteredFunctions: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, functionRegistry } = context
  const errors: Error[] = []

  FUNCTION_TYPES.forEach(functionType => {
    const functionNodes = nodeIndex.findByType<FunctionASTNode>(functionType)

    functionNodes.forEach(node => {
      if (!functionRegistry.has(node.properties.name)) {
        errors.push(buildError(node.properties.name, functionType, node.diagnostics))
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
            errors.push(buildError(name, expressionType, templateMetadata))
          }
        },
      })
    })
  })

  return errors
}
