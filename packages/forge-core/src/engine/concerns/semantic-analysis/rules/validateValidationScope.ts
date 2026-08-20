import { ExpressionType, BlockType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { ValidationASTNode, IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { FieldBlockASTNode, StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import { isTemplateNode } from '../../../chassis/contracts/ast/nodes'
import type { TemplateValue } from '../../../chassis/contracts/ast/template.type'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: 'Validation rules can only be used inside validWhen on a field block or step',
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function collectNodeIdsFromValidWhen(validWhen: unknown): string[] {
  const entries = Array.isArray(validWhen) ? validWhen : [validWhen]
  const ids: string[] = []

  entries.forEach((entry: unknown) => {
    if (
      entry != null &&
      typeof entry === 'object' &&
      'id' in entry &&
      typeof (entry as { id: unknown }).id === 'string'
    ) {
      ids.push((entry as { id: string }).id)
    }
  })

  return ids
}

function walkTemplateForValidationScope(value: TemplateValue, insideValidWhen: boolean, errors: Error[]): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => walkTemplateForValidationScope(item, insideValidWhen, errors))

    return
  }

  if (isTemplateNode(value)) {
    if (value.originalType === ASTNodeType.EXPRESSION) {
      const expressionType = (value as Record<string, unknown>).expressionType as string | undefined

      if (expressionType === ExpressionType.VALIDATION && !insideValidWhen) {
        errors.push(buildError(value.diagnostics))
      }
    }

    const canHaveValidWhen =
      (value.originalType === ASTNodeType.BLOCK && (value as Record<string, unknown>).blockType === BlockType.FIELD) ||
      value.originalType === ASTNodeType.STEP

    if (value.properties) {
      Object.entries(value.properties).forEach(([key, propValue]) => {
        const childScope = canHaveValidWhen && key === 'validWhen'

        walkTemplateForValidationScope(propValue as TemplateValue, childScope, errors)
      })
    }

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'type' || key === 'originalType' || key === 'id' || key === 'properties') {
        return
      }

      walkTemplateForValidationScope(val as TemplateValue, false, errors)
    })

    return
  }

  Object.values(value as Record<string, TemplateValue>).forEach(child => {
    walkTemplateForValidationScope(child, insideValidWhen, errors)
  })
}

function hasValidWhenAncestor(node: ASTNode, validWhenEntryIds: Set<string>): boolean {
  let current: ASTNode | undefined = node

  while (current !== undefined) {
    if (validWhenEntryIds.has(current.id)) {
      return true
    }

    current = current.parent
  }

  return false
}

export const validateValidationScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  const validWhenEntryIds = new Set<string>()

  nodeIndex.findByType<FieldBlockASTNode>(BlockType.FIELD).forEach(block => {
    collectNodeIdsFromValidWhen(block.properties.validWhen).forEach(id => {
      validWhenEntryIds.add(id)
    })
  })

  nodeIndex.findByType<StepASTNode>(ASTNodeType.STEP).forEach(step => {
    collectNodeIdsFromValidWhen(step.properties.validWhen).forEach(id => {
      validWhenEntryIds.add(id)
    })
  })

  nodeIndex.findByType<ValidationASTNode>(ExpressionType.VALIDATION).forEach(node => {
    if (!validWhenEntryIds.has(node.id)) {
      errors.push(buildError(node.diagnostics))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const insideValidWhen = hasValidWhenAncestor(iterateNode, validWhenEntryIds)
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateForValidationScope(template, insideValidWhen, errors)
    })
  })

  return errors
}
