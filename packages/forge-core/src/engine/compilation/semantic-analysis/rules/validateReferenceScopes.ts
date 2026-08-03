import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode, ReferenceASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'
import type { TemplateNode } from '../../../contracts/ast/template.type'
import type { ASTNode } from '../../../contracts/ast/engine.type'

const LOOP_PROPERTIES: ReadonlySet<string> = new Set([
  'index',
  'index0',
  'revindex',
  'revindex0',
  'first',
  'last',
  'length',
])

function createError(
  diagnostics: ASTNodeDiagnostics | undefined,
  message: string,
  code: string,
): ForgeConfigurationReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message,
    code,
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function parseReferenceLevel(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined
  }

  const level = Number(value)

  return Number.isInteger(level) && level >= 0 ? level : undefined
}

function validateItemReference(
  path: (ASTNode | string | number)[],
  iteratorDepth: number,
  diagnostics: ASTNodeDiagnostics | undefined,
): readonly Error[] {
  const level = parseReferenceLevel(path[1])

  if (level === undefined) {
    return [createError(diagnostics, 'Item() reference level must be a non-negative integer', 'item_invalid_level')]
  }

  if (level >= iteratorDepth) {
    const message =
      iteratorDepth === 0
        ? 'Item() can only be used inside an iterator'
        : `Item().parent references level ${level}, but only ${iteratorDepth} iterator scope is available`

    return [createError(diagnostics, message, 'item_outside_iterator_scope')]
  }

  return []
}

function validateLoopReference(
  path: (ASTNode | string | number)[],
  iteratorDepth: number,
  diagnostics: ASTNodeDiagnostics | undefined,
): readonly Error[] {
  const errors: Error[] = []
  const level = parseReferenceLevel(path[1])

  if (level === undefined) {
    return [createError(diagnostics, 'Loop reference level must be a non-negative integer', 'loop_invalid_level')]
  }

  if (level >= iteratorDepth) {
    const message =
      iteratorDepth === 0
        ? 'Loop can only be used inside an iterator'
        : `Loop.Parent references level ${level}, but only ${iteratorDepth} iterator scope is available`

    errors.push(createError(diagnostics, message, 'loop_outside_iterator_scope'))
  }

  const property = path[2]

  if (typeof property !== 'string' || !LOOP_PROPERTIES.has(property)) {
    errors.push(
      createError(
        diagnostics,
        'Loop reference property must be one of index, index0, revindex, revindex0, first, last, length',
        'loop_invalid_property',
      ),
    )
  }

  return errors
}

function validateRegisteredReference(node: ReferenceASTNode): readonly Error[] {
  const path = node.properties.path
  const namespace = path[0]

  // Iterator bodies are lifted into templates at AST build, so any reference still
  // in the registered tree sits outside every iterator scope: its depth is always 0.
  if (namespace === '@scope') {
    return validateItemReference(path, 0, node.diagnostics)
  }

  if (namespace === '@loop') {
    return validateLoopReference(path, 0, node.diagnostics)
  }

  return []
}

function walkIterateTemplateReferences(
  iterator: IterateASTNode['properties']['iterator'],
  currentDepth: number,
  errors: Error[],
): void {
  const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
    (t): t is NonNullable<typeof t> => t !== undefined,
  )

  templates.forEach(template => {
    const visitor = {
      onTemplateNode(templateNode: TemplateNode, templateMetadata: ASTNodeDiagnostics | undefined): boolean | void {
        if (templateNode.originalType !== ASTNodeType.EXPRESSION) {
          return undefined
        }

        const expressionType = (templateNode as Record<string, unknown>).expressionType as string | undefined

        if (expressionType === ExpressionType.ITERATE) {
          if (templateNode.properties?.input) {
            walkTemplateValue(templateNode.properties.input, visitor)
          }

          const nestedIterator = templateNode.properties?.iterator as
            | IterateASTNode['properties']['iterator']
            | undefined

          if (nestedIterator) {
            walkIterateTemplateReferences(nestedIterator, currentDepth + 1, errors)
          }

          return false
        }

        if (expressionType !== ExpressionType.REFERENCE) {
          return undefined
        }

        const refPath = templateNode.properties?.path

        if (!Array.isArray(refPath)) {
          return undefined
        }

        const templateRefPath = refPath as (string | number)[]
        const namespace = templateRefPath[0]

        if (namespace === '@scope') {
          errors.push(...validateItemReference(templateRefPath, currentDepth, templateMetadata))
        }

        if (namespace === '@loop') {
          errors.push(...validateLoopReference(templateRefPath, currentDepth, templateMetadata))
        }

        return undefined
      },
    }

    walkTemplateValue(template, visitor)
  })
}

function validateTemplateReferences(iterateNode: IterateASTNode): readonly Error[] {
  const errors: Error[] = []

  walkIterateTemplateReferences(iterateNode.properties.iterator, 1, errors)

  return errors
}

export const validateReferenceScopes: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  const referenceNodes = nodeIndex.findByType<ReferenceASTNode>(ExpressionType.REFERENCE)

  referenceNodes.forEach(node => {
    errors.push(...validateRegisteredReference(node))
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    errors.push(...validateTemplateReferences(iterateNode))
  })

  return errors
}
