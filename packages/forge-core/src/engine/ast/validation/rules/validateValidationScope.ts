import { ExpressionType, BlockType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { ValidationASTNode, IterateASTNode } from '../../../contracts/ast/expressions.type'
import type { FieldBlockASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import type { DSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { TemplateValue } from '../../../contracts/ast/template.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(metadata: DSLSourceMetadata | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: metadata?.dslPath ? [...metadata.dslPath] : [],
    message: 'Validation rules can only be used inside validWhen on a field block or step',
    code: 'validation_outside_valid_when',
    formattedPath: metadata?.formattedDslPath ?? 'unknown',
  })
}

function collectValidationIdsFromValidWhen(validWhen: unknown): string[] {
  if (!Array.isArray(validWhen)) {
    return []
  }

  const ids: string[] = []

  validWhen.forEach((entry: unknown) => {
    if (
      entry != null &&
      typeof entry === 'object' &&
      'id' in entry &&
      typeof (entry as { id: unknown }).id === 'string' &&
      'expressionType' in entry &&
      (entry as { expressionType: unknown }).expressionType === ExpressionType.VALIDATION
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
        errors.push(buildError(getDSLSourceMetadata(value)))
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

export const validateValidationScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  const validValidationIds = new Set<string>()

  nodeIndex.findByType<FieldBlockASTNode>(BlockType.FIELD).forEach(block => {
    collectValidationIdsFromValidWhen(block.properties.validWhen).forEach(id => {
      validValidationIds.add(id)
    })
  })

  nodeIndex.findByType<StepASTNode>(ASTNodeType.STEP).forEach(step => {
    collectValidationIdsFromValidWhen(step.properties.validWhen).forEach(id => {
      validValidationIds.add(id)
    })
  })

  nodeIndex.findByType<ValidationASTNode>(ExpressionType.VALIDATION).forEach(node => {
    if (!validValidationIds.has(node.id)) {
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
      walkTemplateForValidationScope(template, false, errors)
    })
  })

  return errors
}
