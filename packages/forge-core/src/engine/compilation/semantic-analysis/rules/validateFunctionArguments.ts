import { FunctionType, ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

const FUNCTION_TYPES: readonly string[] = Object.values(FunctionType)

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeConfigurationReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: 'Block definitions cannot be used as function arguments',
    code: 'block_in_function_arguments',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function hasFunctionAncestor(node: ASTNode): boolean {
  let current = node.parent

  while (current !== undefined) {
    if (
      'expressionType' in current &&
      FUNCTION_TYPES.includes((current as { expressionType: string }).expressionType)
    ) {
      return true
    }

    current = current.parent
  }

  return false
}

function isFunctionTemplateNode(node: TemplateNode): boolean {
  if (node.originalType !== ASTNodeType.EXPRESSION) {
    return false
  }

  const expressionType = (node as Record<string, unknown>).expressionType as string | undefined

  return expressionType !== undefined && FUNCTION_TYPES.includes(expressionType)
}

function walkTemplateForBlocks(value: TemplateValue, insideFunction: boolean, errors: Error[]): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => walkTemplateForBlocks(item, insideFunction, errors))

    return
  }

  if (isTemplateNode(value)) {
    const nextInsideFunction = insideFunction || isFunctionTemplateNode(value)

    if (insideFunction && value.originalType === ASTNodeType.BLOCK) {
      errors.push(buildError(value.diagnostics))
    }

    if (value.properties) {
      Object.values(value.properties).forEach(propValue => {
        walkTemplateForBlocks(propValue as TemplateValue, nextInsideFunction, errors)
      })
    }

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'type' || key === 'originalType' || key === 'id' || key === 'properties') {
        return
      }

      walkTemplateForBlocks(val as TemplateValue, nextInsideFunction, errors)
    })

    return
  }

  Object.values(value as Record<string, TemplateValue>).forEach(child => {
    walkTemplateForBlocks(child, insideFunction, errors)
  })
}

export const validateFunctionArguments: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.BLOCK).forEach(node => {
    if (hasFunctionAncestor(node)) {
      errors.push(buildError(node.diagnostics))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateForBlocks(template, false, errors)
    })
  })

  return errors
}
