import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode, ReferenceASTNode } from '../../../contracts/ast/expressions.type'
import { isIterateExprNode } from '../../../contracts/ast/expression-nodes'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { DSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import getAncestorChain from '../../ast-state/getAncestorChain'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'
import type { TemplateNode } from '../../../contracts/ast/template.type'
import type { ASTNode, NodeId } from '../../../contracts/ast/engine.type'

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
  metadata: DSLSourceMetadata | undefined,
  message: string,
  code: string,
): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: metadata?.dslPath ? [...metadata.dslPath] : [],
    message,
    code,
    formattedPath: metadata?.formattedDslPath ?? 'unknown',
  })
}

function parseReferenceLevel(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined
  }

  const level = Number(value)

  return Number.isInteger(level) && level >= 0 ? level : undefined
}

function getIteratorDepthForNode(nodeId: NodeId, context: ASTValidationContext): number {
  const ancestors = getAncestorChain(nodeId, context.nodeTree)

  let depth = 0

  ancestors.forEach(ancestorId => {
    if (ancestorId === nodeId) {
      return
    }

    const ancestor = context.nodeIndex.get(ancestorId)

    if (!ancestor || !isIterateExprNode(ancestor)) {
      return
    }

    const iterateNode = ancestor as IterateASTNode

    if (isInsideIteratorTemplate(nodeId, iterateNode, context)) {
      depth += 1
    }
  })

  return depth
}

function isInsideIteratorTemplate(
  descendantId: NodeId,
  iterateNode: IterateASTNode,
  context: ASTValidationContext,
): boolean {
  const inputNode = iterateNode.properties.input

  if (inputNode && typeof inputNode === 'object' && 'id' in inputNode) {
    const inputId = (inputNode as ASTNode).id

    if (descendantId === inputId || context.nodeTree.isDescendantOf(descendantId, inputId)) {
      return false
    }
  }

  return true
}

function validateItemReference(
  path: (ASTNode | string | number)[],
  iteratorDepth: number,
  metadata: DSLSourceMetadata | undefined,
): readonly Error[] {
  const level = parseReferenceLevel(path[1])

  if (level === undefined) {
    return [createError(metadata, 'Item() reference level must be a non-negative integer', 'item_invalid_level')]
  }

  if (level >= iteratorDepth) {
    const message =
      iteratorDepth === 0
        ? 'Item() can only be used inside an iterator'
        : `Item().parent references level ${level}, but only ${iteratorDepth} iterator scope is available`

    return [createError(metadata, message, 'item_outside_iterator_scope')]
  }

  return []
}

function validateLoopReference(
  path: (ASTNode | string | number)[],
  iteratorDepth: number,
  metadata: DSLSourceMetadata | undefined,
): readonly Error[] {
  const errors: Error[] = []
  const level = parseReferenceLevel(path[1])

  if (level === undefined) {
    return [createError(metadata, 'Loop reference level must be a non-negative integer', 'loop_invalid_level')]
  }

  if (level >= iteratorDepth) {
    const message =
      iteratorDepth === 0
        ? 'Loop can only be used inside an iterator'
        : `Loop.Parent references level ${level}, but only ${iteratorDepth} iterator scope is available`

    errors.push(createError(metadata, message, 'loop_outside_iterator_scope'))
  }

  const property = path[2]

  if (typeof property !== 'string' || !LOOP_PROPERTIES.has(property)) {
    errors.push(
      createError(
        metadata,
        'Loop reference property must be one of index, index0, revindex, revindex0, first, last, length',
        'loop_invalid_property',
      ),
    )
  }

  return errors
}

function validateRegisteredReference(node: ReferenceASTNode, context: ASTValidationContext): readonly Error[] {
  const path = node.properties.path
  const namespace = path[0]

  if (namespace === '@scope') {
    const depth = getIteratorDepthForNode(node.id, context)

    return validateItemReference(path, depth, getDSLSourceMetadata(node))
  }

  if (namespace === '@loop') {
    const depth = getIteratorDepthForNode(node.id, context)

    return validateLoopReference(path, depth, getDSLSourceMetadata(node))
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
      onTemplateNode(templateNode: TemplateNode, templateMetadata: DSLSourceMetadata | undefined): boolean | void {
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

function validateTemplateReferences(iterateNode: IterateASTNode, parentIterateDepth: number): readonly Error[] {
  const errors: Error[] = []
  const templateDepth = parentIterateDepth + 1

  walkIterateTemplateReferences(iterateNode.properties.iterator, templateDepth, errors)

  return errors
}

export const validateReferenceScopes: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  const referenceNodes = nodeIndex.findByType<ReferenceASTNode>(ExpressionType.REFERENCE)

  referenceNodes.forEach(node => {
    errors.push(...validateRegisteredReference(node, context))
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const parentDepth = getIteratorDepthForNode(iterateNode.id, context)

    errors.push(...validateTemplateReferences(iterateNode, parentDepth))
  })

  return errors
}
