import { isTemplateNode } from '../../../contracts/ast/nodes'
import { TemplateNode } from '../../../contracts/ast/template.type'
import { FieldCodeKind, type DynamicFieldCode, type StaticFieldCode } from '../../../contracts/models/fieldModel.type'
import { Code, code, literal, SafeCode } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'

/**
 * Emits field code expressions consistently across generated-function compilers.
 *
 * Field codes can be static strings or authored expressions. The compilers use
 * the resulting expression for answer lookup, Self() resolution, validation
 * metadata, and field inventory, so this keeps their string coercion rules in
 * one place.
 */
export default class FieldCodeEmitter {
  constructor(private readonly expr: ExpressionDispatcher) {}

  /**
   * Emits a classified field-code model as either a string literal or a scoped
   * const. Dynamic template codes compile under the current iterator scope, so
   * callers must already be inside the occurrence's loop nest.
   */
  compileModelExpression(
    fieldCode: StaticFieldCode | DynamicFieldCode | undefined,
    generator: CodeGenerator,
  ): Code | Name | undefined {
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
  ): Code | Name | undefined {
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
  compileRegisteredInlineExpression(fieldCode: unknown): Code | undefined {
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
  ): Code | Name | undefined {
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

    generator.assign(code`${targetObject}[${key}]`, codeExpression)
  }
}
