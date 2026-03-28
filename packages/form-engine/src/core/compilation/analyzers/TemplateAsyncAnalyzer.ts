import { isTemplateNode } from '@form-engine/core/typeguards/nodes'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TemplateNode } from '@form-engine/core/types/template.type'
import { ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import { isObjectValue } from '@form-engine/typeguards/primitives'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'

const FUNCTION_EXPRESSION_TYPES = new Set<string>([
  FunctionType.CONDITION,
  FunctionType.TRANSFORMER,
  FunctionType.GENERATOR,
])

export default class TemplateAsyncAnalyzer {
  static containsAsyncNodes(template: unknown, functionRegistry: FunctionRegistry): boolean {
    if (template === undefined) {
      return false
    }

    if (Array.isArray(template)) {
      return template.some(entry => TemplateAsyncAnalyzer.containsAsyncNodes(entry, functionRegistry))
    }

    if (!isObjectValue(template)) {
      return false
    }

    if (isTemplateNode(template)) {
      return TemplateAsyncAnalyzer.templateNodeContainsAsync(template, functionRegistry)
    }

    return Object.values(template).some(entry => TemplateAsyncAnalyzer.containsAsyncNodes(entry, functionRegistry))
  }

  private static templateNodeContainsAsync(node: TemplateNode, functionRegistry: FunctionRegistry): boolean {
    if (TemplateAsyncAnalyzer.isAsyncExpression(node, functionRegistry)) {
      return true
    }

    if (TemplateAsyncAnalyzer.isIterateExpression(node)) {
      return TemplateAsyncAnalyzer.iterateContainsAsync(node, functionRegistry)
    }

    return TemplateAsyncAnalyzer.containsAsyncNodes(node.properties, functionRegistry)
  }

  private static isAsyncExpression(node: TemplateNode, functionRegistry: FunctionRegistry): boolean {
    if (node.originalType !== ASTNodeType.EXPRESSION) {
      return false
    }

    if (node.expressionType === FunctionType.EFFECT) {
      return true
    }

    if (FUNCTION_EXPRESSION_TYPES.has(node.expressionType as string)) {
      const functionName = node.properties?.name as string | undefined

      if (!functionName) {
        return true
      }

      const entry = functionRegistry.get(functionName)

      return entry?.isAsync ?? true
    }

    return false
  }

  private static isIterateExpression(node: TemplateNode): boolean {
    return node.originalType === ASTNodeType.EXPRESSION && node.expressionType === ExpressionType.ITERATE
  }

  private static iterateContainsAsync(node: TemplateNode, functionRegistry: FunctionRegistry): boolean {
    const iterator = node.properties?.iterator

    if (!isObjectValue(iterator)) {
      return false
    }

    if (
      'yieldTemplate' in iterator &&
      TemplateAsyncAnalyzer.containsAsyncNodes(iterator.yieldTemplate, functionRegistry)
    ) {
      return true
    }

    if (
      'predicateTemplate' in iterator &&
      TemplateAsyncAnalyzer.containsAsyncNodes(iterator.predicateTemplate, functionRegistry)
    ) {
      return true
    }

    return false
  }
}
