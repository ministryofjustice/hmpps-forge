import { FunctionType, ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { DSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import type { AstNodeId } from '../../../contracts/ast/ast.type'
import getAncestorChain from '../../ast-state/getAncestorChain'
import type { ASTValidationContext, ASTValidationRule } from './types'

const FUNCTION_TYPES: readonly string[] = Object.values(FunctionType)

function buildError(metadata: DSLSourceMetadata | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: metadata?.dslPath ? [...metadata.dslPath] : [],
    message: 'Block definitions cannot be used as function arguments',
    code: 'block_in_function_arguments',
    formattedPath: metadata?.formattedDslPath ?? 'unknown',
  })
}

function hasFunctionAncestor(context: ASTValidationContext, nodeId: AstNodeId): boolean {
  const ancestors = getAncestorChain(nodeId, context.nodeTree)

  return ancestors.some(ancestorId => {
    if (ancestorId === nodeId) {
      return false
    }

    const ancestor = context.nodeIndex.get(ancestorId)

    if (!ancestor || !('expressionType' in ancestor)) {
      return false
    }

    return FUNCTION_TYPES.includes((ancestor as { expressionType: string }).expressionType)
  })
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
      errors.push(buildError(getDSLSourceMetadata(value)))
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
    if (hasFunctionAncestor(context, node.id)) {
      errors.push(buildError(getDSLSourceMetadata(node)))
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
