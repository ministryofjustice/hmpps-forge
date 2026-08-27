import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeFamily, astNodeFamily } from '../../../chassis/contracts/ast/enums'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import { isTemplateASTNode } from '../../../chassis/contracts/ast/nodes'
import type { TemplateASTNode } from '../../../chassis/contracts/ast/ast.type'
import type { TemplateValue } from '../../../chassis/contracts/ast/template.type'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Block definitions cannot be used as function arguments',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function hasFunctionAncestor(node: ASTNode): boolean {
  let current = node.parent

  while (current !== undefined) {
    if (astNodeFamily(current.kind) === ASTNodeFamily.FUNCTION_CALL) {
      return true
    }

    current = current.parent
  }

  return false
}

function isFunctionTemplateNode(node: TemplateASTNode): boolean {
  return astNodeFamily(node.kind) === ASTNodeFamily.FUNCTION_CALL
}

function walkTemplateForBlocks(value: TemplateValue, insideFunction: boolean, errors: Error[]): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => walkTemplateForBlocks(item, insideFunction, errors))

    return
  }

  if (isTemplateASTNode(value)) {
    const nextInsideFunction = insideFunction || isFunctionTemplateNode(value)

    if (insideFunction && astNodeFamily(value.kind) === ASTNodeFamily.COMPONENT_CALL) {
      errors.push(buildError(value.diagnostics))
    }

    if (value.properties) {
      Object.values(value.properties).forEach(propValue => {
        walkTemplateForBlocks(propValue as TemplateValue, nextInsideFunction, errors)
      })
    }

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'kind' || key === 'isTemplate' || key === 'id' || key === 'properties') {
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

  nodeIndex.findByFamily(ASTNodeFamily.COMPONENT_CALL).forEach(node => {
    if (hasFunctionAncestor(node)) {
      errors.push(buildError(node.diagnostics))
    }
  })

  const iterateNodes = nodeIndex.findByKind<IterateASTNode>(ExpressionType.ITERATE)

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
