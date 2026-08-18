import { FunctionType } from '../../../../authoring/types/enums'
import type { FunctionASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ForgeUnregisteredFunctionError from '../../../errors/ForgeUnregisteredFunctionError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

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
  const { nodeIndex, templateNodeIndex, functionRegistry } = context
  const errors: Error[] = []

  FUNCTION_TYPES.forEach(functionType => {
    nodeIndex.findByType<FunctionASTNode>(functionType).forEach(node => {
      if (!functionRegistry.has(node.properties.name)) {
        errors.push(buildError(node.properties.name, functionType, node.diagnostics))
      }
    })

    templateNodeIndex.findByType(functionType).forEach(({ node }) => {
      const name = (node.properties?.name as string) ?? ''

      if (!functionRegistry.has(name)) {
        errors.push(buildError(name, functionType, node.diagnostics))
      }
    })
  })

  return errors
}
