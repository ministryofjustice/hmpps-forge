import { isTemplateNode } from '../../../contracts/ast/nodes'
import { TemplateNode } from '../../../contracts/ast/template.type'
import { FieldCodeKind, type DynamicFieldCode, type StaticFieldCode } from '../../../contracts/models/fieldModel.type'
import { CodeFragment, code, literal, propertyCode, SafeCode } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'

/**
 * Emits field code expressions consistently across generated-function compilers.
 *
 * A field code identifies a field -- it can be a static string or an authored
 * expression. Compilers use the resulting expression for answer lookup,
 * `Self()` resolution, validation metadata, and field inventory, so this
 * class keeps the string coercion rules in one place.
 */
export default class FieldCodeEmitter {
  constructor(private readonly expr: ExpressionDispatcher) {}

  /**
   * Emits a field-code model as either a string literal or a scoped `const`.
   * Dynamic codes (those derived from an expression) compile under the current
   * iterator scope, so callers must already be inside the enclosing loop.
   */
  compileModelExpression(
    fieldCode: StaticFieldCode | DynamicFieldCode | undefined,
    generator: CodeGenerator,
  ): CodeFragment | IdentifierName | undefined {
    if (fieldCode === undefined) {
      return undefined
    }

    if (fieldCode.kind === FieldCodeKind.STATIC) {
      return literal(fieldCode.value)
    }

    const variableName = isTemplateNode(fieldCode.node.node) ? 'templateCode' : 'fieldCode'

    return generator.const(variableName, code`String(${this.expr.compileOperandCode(fieldCode.node.node)})`)
  }

  /**
   * Emits a registered field code as either a string literal or a scoped const.
   */
  compileRegisteredExpression(
    fieldCode: unknown,
    generator: CodeGenerator,
    variableName = 'fieldCode',
  ): CodeFragment | IdentifierName | undefined {
    const codeExpression = this.compileRegisteredInlineExpression(fieldCode)

    if (codeExpression === undefined) {
      return undefined
    }

    if (typeof fieldCode === 'string') {
      return codeExpression
    }

    return generator.const(variableName, codeExpression)
  }

  /**
   * Emits a registered field code as an inline expression, used when assigning block properties.
   */
  compileRegisteredInlineExpression(fieldCode: unknown): CodeFragment | undefined {
    if (typeof fieldCode === 'string') {
      return literal(fieldCode)
    }

    if (this.expr.isCompilableNode(fieldCode) || this.expr.isTemplateNode(fieldCode)) {
      return code`String(${this.expr.compileOperandCode(fieldCode)})`
    }

    return undefined
  }

  /**
   * Emits a template field code under the current iterator/template scope.
   */
  compileTemplateExpression(
    node: TemplateNode,
    generator: CodeGenerator,
    variableName = 'templateCode',
  ): CodeFragment | IdentifierName | undefined {
    const fieldCode = node.properties?.code

    if (typeof fieldCode === 'string') {
      return literal(fieldCode)
    }

    if (!this.expr.isTemplateNode(fieldCode)) {
      return undefined
    }

    return generator.const(variableName, code`String(${this.expr.compileTemplateExpressionCode(fieldCode)})`)
  }

  /**
   * Assigns a FIELD block's code property only when it resolves to a string expression.
   */
  assignProperty(
    fieldCode: unknown,
    generator: CodeGenerator,
    targetObject: SafeCode,
    key: string,
    preferredCodeExpression?: SafeCode,
  ): void {
    const codeExpression = preferredCodeExpression ?? this.compileRegisteredInlineExpression(fieldCode)

    if (codeExpression === undefined) {
      return
    }

    generator.assign(code`${targetObject}${propertyCode(key)}`, codeExpression)
  }
}
