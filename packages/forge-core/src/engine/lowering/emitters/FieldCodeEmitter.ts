import { TemplateNode } from '../../contracts/ast/template.type'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import CodeEmitter from './CodeEmitter'

/**
 * Emits field code expressions consistently across generated-function compilers.
 *
 * Field codes can be static strings or authored expressions. The compilers use
 * the resulting expression for answer lookup, validation failure IDs, render
 * block IDs, and field inventory, so this keeps their string coercion rules in
 * one place.
 */
export default class FieldCodeEmitter {
  constructor(private readonly expr: ExpressionDispatcher) {}

  /**
   * Emits a registered field code as either a string literal or a scoped const.
   */
  compileRegisteredExpression(code: unknown, emitter: CodeEmitter, variableName = 'fieldCode'): string | undefined {
    const codeExpr = this.compileRegisteredInlineExpression(code)

    if (codeExpr === undefined) {
      return undefined
    }

    if (typeof code === 'string') {
      return codeExpr
    }

    return emitter.const(variableName, codeExpr)
  }

  /**
   * Emits a registered field code as an inline expression, used when assigning block properties.
   */
  compileRegisteredInlineExpression(code: unknown): string | undefined {
    if (typeof code === 'string') {
      return JSON.stringify(code)
    }

    if (this.expr.isCompilableNode(code) || this.expr.isTemplateNode(code)) {
      return `String(${this.expr.compileOperand(code)})`
    }

    return undefined
  }

  /**
   * Emits a template field code under the current iterator/template scope.
   */
  compileTemplateExpression(
    node: TemplateNode,
    emitter: CodeEmitter,
    variableName = 'templateCode',
  ): string | undefined {
    const code = node.properties?.code

    if (typeof code === 'string') {
      return JSON.stringify(code)
    }

    if (!this.expr.isTemplateNode(code)) {
      return undefined
    }

    return emitter.const(variableName, `String(${this.expr.compileTemplateExpression(code)})`)
  }

  /**
   * Emits the render/validation block ID used for FIELD blocks created from iterator templates.
   */
  compileIteratorFieldBlockIdExpression(codeExpr: string | undefined, fallbackId: string): string {
    if (codeExpr !== undefined) {
      return `"compiled:" + ${codeExpr}`
    }

    return JSON.stringify(`compiled:${fallbackId}`)
  }

  /**
   * Assigns a FIELD block's code property only when it resolves to a string expression.
   */
  assignProperty(
    code: unknown,
    emitter: CodeEmitter,
    targetObj: string,
    key: string,
    preferredCodeExpr?: string,
  ): void {
    const codeExpr = preferredCodeExpr ?? this.compileRegisteredInlineExpression(code)

    if (codeExpr === undefined) {
      return
    }

    emitter.assign(`${targetObj}[${JSON.stringify(key)}]`, codeExpr)
  }
}
