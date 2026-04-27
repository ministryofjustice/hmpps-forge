import { TemplateValue } from '../../../types/template.type'
import { NodeCompilationContext } from './types'

export default class ReferenceNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

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

  private compileBaseReference(base: unknown, path: (string | number | TemplateValue)[]): string {
    const baseExpr = this.ctx.compileOperand(base)

    return path.reduce<string>((acc, segment) => `${acc}?.[${JSON.stringify(String(segment))}]`, `(${baseExpr})`)
  }

  private compileAnswerReference(path: (string | number | TemplateValue)[]): string {
    if (path.length < 2) {
      return 'undefined'
    }

    const fieldCode = path[1]

    if (fieldCode === '@self') {
      return this.compileSelfAnswerReference(path)
    }

    if (typeof fieldCode !== 'string') {
      return 'undefined'
    }

    let expr = `ctx.answers[${JSON.stringify(fieldCode)}]?.current`

    for (let i = 2; i < path.length; i++) {
      expr += `?.[${JSON.stringify(String(path[i]))}]`
    }

    return expr
  }

  private compileSelfAnswerReference(path: (string | number | TemplateValue)[]): string {
    const frame = this.ctx.iteratorStack[this.ctx.iteratorStack.length - 1]

    if (frame?.codeVar) {
      let expr = `ctx.answers[${frame.codeVar}]?.current`

      for (let i = 2; i < path.length; i++) {
        expr += `?.[${JSON.stringify(String(path[i]))}]`
      }

      return expr
    }

    return 'undefined'
  }

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
