import { ExpressionType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../ast/ast.type'
import { ASTNodeType } from '../ast/enums'
import { isASTNode, isTemplateNode } from '../ast/nodes'
import type { TemplateNode } from '../ast/template.type'
import { AuthoredValueKind, type AuthoredValue, type ExpressionValue } from './authoredValue.type'
import { ValidationRulesKind, type ValidationRulesModel } from './fieldModel.type'

/**
 * Classifiers for authored validation values, kept beside the model types (the
 * `contracts/ast/nodes.ts` precedent) so analysis and lowering share one
 * definition of "configured" and "direct rule".
 */

/** `undefined` and empty arrays are absent; any other value counts as configured. */
export function hasConfiguredValue(value: unknown): boolean {
  if (value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}

/**
 * An authored array of validation expressions compiles rule-by-rule; any other
 * shape is materialised through the runtime value compiler.
 */
export function classifyValidationRules(
  value: unknown,
  classify: (value: unknown) => AuthoredValue,
): ValidationRulesModel {
  if (Array.isArray(value)) {
    const directRules = value.filter(isDirectValidationRule)

    if (directRules.length === value.length) {
      return {
        kind: ValidationRulesKind.DIRECT,
        rules: directRules.map((rule): ExpressionValue => ({ kind: AuthoredValueKind.EXPRESSION, node: rule })),
      }
    }
  }

  return { kind: ValidationRulesKind.DYNAMIC, value: classify(value) }
}

function isDirectValidationRule(value: unknown): value is ASTNode | TemplateNode {
  if (isTemplateNode(value)) {
    return value.originalType === ASTNodeType.EXPRESSION && value.expressionType === ExpressionType.VALIDATION
  }

  if (!isASTNode(value) || !('id' in value) || value.type !== ASTNodeType.EXPRESSION) {
    return false
  }

  return 'expressionType' in value && value.expressionType === ExpressionType.VALIDATION
}
