import { isTemplateNode } from '@form-engine/core/typeguards/nodes'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TemplateNode } from '@form-engine/core/types/template.type'
import { BlockType, ExpressionType } from '@form-engine/form/types/enums'
import { isObjectValue } from '@form-engine/typeguards/primitives'

export default class ValidationTemplateAnalyzer {
  static mayYieldFields(template: unknown): boolean {
    return ValidationTemplateAnalyzer.mayYieldMatchingFields(
      template,
      node => node.originalType === ASTNodeType.BLOCK && node.blockType === BlockType.FIELD,
    )
  }

  static mayYieldValidatingFields(template: unknown): boolean {
    return ValidationTemplateAnalyzer.mayYieldMatchingFields(template, node => {
      if (node.originalType !== ASTNodeType.BLOCK || node.blockType !== BlockType.FIELD) {
        return false
      }

      const validations = node.properties?.validate

      return Array.isArray(validations) && validations.length > 0
    })
  }

  private static mayYieldMatchingFields(template: unknown, fieldMatcher: (node: TemplateNode) => boolean): boolean {
    if (template === undefined) {
      return false
    }

    if (Array.isArray(template)) {
      return template.some(entry => ValidationTemplateAnalyzer.mayYieldMatchingFields(entry, fieldMatcher))
    }

    if (!isObjectValue(template)) {
      return false
    }

    if (isTemplateNode(template)) {
      return ValidationTemplateAnalyzer.templateNodeMayYieldMatchingFields(template, fieldMatcher)
    }

    return Object.values(template).some(entry => ValidationTemplateAnalyzer.mayYieldMatchingFields(entry, fieldMatcher))
  }

  private static templateNodeMayYieldMatchingFields(
    node: TemplateNode,
    fieldMatcher: (node: TemplateNode) => boolean,
  ): boolean {
    if (fieldMatcher(node)) {
      return true
    }

    if (ValidationTemplateAnalyzer.isIterateExpression(node)) {
      return ValidationTemplateAnalyzer.mayYieldMatchingFields(
        ValidationTemplateAnalyzer.getIterateYieldTemplate(node),
        fieldMatcher,
      )
    }

    return ValidationTemplateAnalyzer.mayYieldMatchingFields(node.properties, fieldMatcher)
  }

  private static isIterateExpression(node: TemplateNode): boolean {
    return node.originalType === ASTNodeType.EXPRESSION && node.expressionType === ExpressionType.ITERATE
  }

  private static getIterateYieldTemplate(node: TemplateNode): unknown {
    const iterator = node.properties?.iterator

    if (!isObjectValue(iterator) || !('yieldTemplate' in iterator)) {
      return undefined
    }

    return iterator.yieldTemplate
  }
}
