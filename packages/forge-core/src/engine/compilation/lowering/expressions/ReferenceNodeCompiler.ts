import { TemplateValue } from '../../../contracts/ast/template.type'
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
   * Routes reference paths to their runtime namespace or scoped iterator frame.
   */
  compile(properties: Record<string, unknown>): string {
    const path = (properties.path ?? []) as (string | number | TemplateValue)[]
    const base = properties.base

    if (path.length === 0) {
      if (base !== undefined) {
        return this.ctx.compileOperand(base)
      }

      return 'undefined'
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

    const ctxNamespace = this.ctx.namespaceToCtx(namespace)
    const remaining = path.slice(1)

    if (remaining.length === 0) {
      return ctxNamespace
    }

    return remaining.reduce<string>((acc, segment) => `${acc}?.[${JSON.stringify(String(segment))}]`, ctxNamespace)
  }

  /**
   * Applies a relative path to an already-compiled base expression.
   */
  private compileBaseReference(base: unknown, path: (string | number | TemplateValue)[]): string {
    const baseExpr = this.ctx.compileOperand(base)

    return path.reduce<string>((acc, segment) => `${acc}?.[${JSON.stringify(String(segment))}]`, `(${baseExpr})`)
  }

  /**
   * Resolves answers[fieldCode].current, including dynamic field-code operands.
   */
  private compileAnswerReference(path: (string | number | TemplateValue)[]): string {
    if (path.length < 2) {
      return 'undefined'
    }

    const fieldCode = path[1]

    if (fieldCode === '@self') {
      return this.compileSelfAnswerReference(path)
    }

    const fieldCodeExpr =
      typeof fieldCode === 'string' ? JSON.stringify(fieldCode) : `String(${this.ctx.compileOperand(fieldCode)})`
    let expr = `ctx.answers[${fieldCodeExpr}]?.current`

    for (let i = 2; i < path.length; i++) {
      expr += `?.[${JSON.stringify(String(path[i]))}]`
    }

    return expr
  }

  /**
   * Resolves @self references against the field code supplied by the caller.
   */
  private compileSelfAnswerReference(path: (string | number | TemplateValue)[]): string {
    const selfCodeExpr = this.ctx.selfCodeExpr

    if (selfCodeExpr !== undefined) {
      let expr = `ctx.answers[${selfCodeExpr}]?.current`

      for (let i = 2; i < path.length; i++) {
        expr += `?.[${JSON.stringify(String(path[i]))}]`
      }

      return expr
    }

    return 'undefined'
  }

  /**
   * Resolves @scope references from the active iterator stack frame.
   */
  private compileIteratorScopeReference(path: (string | number | TemplateValue)[]): string {
    if (path.length < 2) {
      return 'undefined'
    }

    const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)
    const frame = this.ctx.iteratorStack[this.ctx.iteratorStack.length - 1 - level]

    if (!frame) {
      return 'undefined'
    }

    if (path.length === 2) {
      return frame.rawItemExpr
    }

    const property = path[2] as string

    if (property === '@key') {
      return `${frame.itemVar}["@key"]`
    }

    if (property === '@item') {
      return frame.rawItemExpr
    }

    if (property === '@value') {
      return `${frame.itemVar}["@value"]`
    }

    let expr = `${frame.itemVar}[${JSON.stringify(property)}]`

    for (let i = 3; i < path.length; i++) {
      expr += `?.[${JSON.stringify(String(path[i]))}]`
    }

    return expr
  }

  /**
   * Resolves @loop metadata such as index, first, last, and length.
   */
  private compileIteratorLoopReference(path: (string | number | TemplateValue)[]): string {
    if (path.length < 3) {
      return 'undefined'
    }

    const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)
    const frame = this.ctx.iteratorStack[this.ctx.iteratorStack.length - 1 - level]

    if (!frame) {
      return 'undefined'
    }

    const property = path[2] as string

    if (property === 'index') {
      return `(${frame.indexVar} + 1)`
    }

    if (property === 'index0') {
      return frame.indexVar
    }

    if (property === 'revindex') {
      return `(${frame.inputLengthExpr} - ${frame.indexVar})`
    }

    if (property === 'revindex0') {
      return `(${frame.inputLengthExpr} - ${frame.indexVar} - 1)`
    }

    if (property === 'first') {
      return `${frame.indexVar} === 0`
    }

    if (property === 'last') {
      return `${frame.indexVar} === ${frame.inputLengthExpr} - 1`
    }

    if (property === 'length') {
      return frame.inputLengthExpr
    }

    return 'undefined'
  }
}
