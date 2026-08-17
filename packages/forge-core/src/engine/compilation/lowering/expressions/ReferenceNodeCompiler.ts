import { TemplateValue } from '../../../contracts/ast/template.type'
import { CodeFragment, code, literal, optionalPropertyCode, propertyCode } from '../codegen/fragments/CodeFragment'
import IdentifierName from '../codegen/fragments/IdentifierName'
import { NodeCompilationContext } from './types'

/**
 * Compiles authored reference paths to safe JavaScript property access.
 *
 * This is where DSL namespaces such as answers, @self, @scope, and @loop are
 * translated into the runtime values available inside generated functions.
 */
export default class ReferenceNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Routes a reference path to its runtime source: a namespace like `data` or
   * `session`, the `@self` field, or a scoped iterator frame (the item/index
   * variables from a surrounding loop).
   */
  compile(properties: Record<string, unknown>): CodeFragment {
    const path = (properties.path ?? []) as (string | number | TemplateValue)[]
    const base = properties.base

    if (path.length === 0) {
      if (base !== undefined) {
        return this.ctx.compileOperandCode(base)
      }

      return literal(undefined)
    }

    if (base !== undefined) {
      return this.compileBaseReference(base, path)
    }

    const namespace = path[0] as string

    if (namespace === '@scope') {
      return this.compileIteratorScopeReference(path)
    }

    if (namespace === '@loop') {
      return this.compileIteratorLoopReference(path)
    }

    if (namespace === '@self') {
      return this.compileSelfAnswerReference(['answers', ...path])
    }

    if (namespace === 'answers') {
      return this.compileAnswerReference(path)
    }

    const ctxNamespace = this.ctx.namespaceToCtxCode(namespace)
    const remaining = path.slice(1)

    if (remaining.length === 0) {
      return ctxNamespace
    }

    return remaining.reduce<CodeFragment>(
      (acc, segment) => code`${acc}${optionalPropertyCode(String(segment))}`,
      ctxNamespace,
    )
  }

  /**
   * Applies a relative path to an already-compiled base expression.
   */
  private compileBaseReference(base: unknown, path: (string | number | TemplateValue)[]): CodeFragment {
    const baseExpr = this.ctx.compileOperandCode(base)

    return path.reduce<CodeFragment>(
      (acc, segment) => code`${acc}${optionalPropertyCode(String(segment))}`,
      code`(${baseExpr})`,
    )
  }

  /**
   * Resolves answers[fieldCode].current, including dynamic field-code operands.
   */
  private compileAnswerReference(path: (string | number | TemplateValue)[]): CodeFragment {
    if (path.length < 2) {
      return literal(undefined)
    }

    const fieldCode = path[1]

    if (fieldCode === '@self') {
      return this.compileSelfAnswerReference(path)
    }

    const fieldAccess =
      typeof fieldCode === 'string'
        ? propertyCode(fieldCode)
        : code`[String(${this.ctx.compileOperandCode(fieldCode)})]`
    let expr = code`ctx.answers${fieldAccess}?.current`

    for (let i = 2; i < path.length; i++) {
      expr = code`${expr}${optionalPropertyCode(String(path[i]))}`
    }

    return expr
  }

  /**
   * Resolves @self references against the field code supplied by the caller.
   */
  private compileSelfAnswerReference(path: (string | number | TemplateValue)[]): CodeFragment {
    const selfCodeExpr = this.ctx.selfCodeExpr

    if (selfCodeExpr !== undefined) {
      let expr = code`ctx.answers[${selfCodeExpr}]?.current`

      for (let i = 2; i < path.length; i++) {
        expr = code`${expr}${optionalPropertyCode(String(path[i]))}`
      }

      return expr
    }

    return literal(undefined)
  }

  /**
   * Resolves @scope references from the active iterator stack frame.
   */
  private compileIteratorScopeReference(path: (string | number | TemplateValue)[]): CodeFragment {
    if (path.length < 2) {
      return literal(undefined)
    }

    const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)
    const frame = this.ctx.iteratorStack[this.ctx.iteratorStack.length - 1 - level]

    if (!frame) {
      return literal(undefined)
    }

    if (path.length === 2) {
      return toCode(frame.rawItemExpr)
    }

    const property = path[2] as string
    const itemVar = toCode(frame.itemVar)
    const rawItemExpr = toCode(frame.rawItemExpr)

    if (property === '@key') {
      return code`${itemVar}["@key"]`
    }

    if (property === '@item') {
      return rawItemExpr
    }

    if (property === '@value') {
      return code`${itemVar}["@value"]`
    }

    let expr = code`${itemVar}${propertyCode(property)}`

    for (let i = 3; i < path.length; i++) {
      expr = code`${expr}${optionalPropertyCode(String(path[i]))}`
    }

    return expr
  }

  /**
   * Resolves @loop metadata such as index, first, last, and length.
   */
  private compileIteratorLoopReference(path: (string | number | TemplateValue)[]): CodeFragment {
    if (path.length < 3) {
      return literal(undefined)
    }

    const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)
    const frame = this.ctx.iteratorStack[this.ctx.iteratorStack.length - 1 - level]

    if (!frame) {
      return literal(undefined)
    }

    const property = path[2] as string
    const indexVar = toCode(frame.indexVar)
    const inputLengthExpr = toCode(frame.inputLengthExpr)

    if (property === 'index') {
      return code`(${indexVar} + 1)`
    }

    if (property === 'index0') {
      return indexVar
    }

    if (property === 'revindex') {
      return code`(${inputLengthExpr} - ${indexVar})`
    }

    if (property === 'revindex0') {
      return code`(${inputLengthExpr} - ${indexVar} - 1)`
    }

    if (property === 'first') {
      return code`${indexVar} === 0`
    }

    if (property === 'last') {
      return code`${indexVar} === ${inputLengthExpr} - 1`
    }

    if (property === 'length') {
      return inputLengthExpr
    }

    return literal(undefined)
  }
}

const toCode = (value: CodeFragment | IdentifierName): CodeFragment =>
  value instanceof IdentifierName ? code`${value}` : value
