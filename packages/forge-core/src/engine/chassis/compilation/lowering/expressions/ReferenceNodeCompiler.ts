import type { AuthoredValue, ReferenceValue } from '../../../contracts/models/authoredValue.type'
import { CodeFragment, code, literal, optionalPropertyCode, propertyCode } from '../codegen/fragments/CodeFragment'
import IdentifierName from '../codegen/fragments/IdentifierName'
import { IteratorScopeFrame, NodeCompilationContext } from './types'

/**
 * Compiles authored reference paths to safe JavaScript property access.
 *
 * This is where DSL namespaces such as answers, @self, and @loop are
 * translated into the runtime values available inside generated functions.
 */
export default class ReferenceNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Routes a reference path to its runtime source: a namespace like `data` or
   * `session`, the `@self` field, or a scoped iterator frame (the item/index
   * variables from a surrounding loop).
   */
  compile(properties: ReferenceValue): CodeFragment {
    const path = properties.path
    const base = properties.base

    if (path.length === 0) {
      if (base !== undefined) {
        return this.ctx.compileValueCode(base)
      }

      return literal(undefined)
    }

    if (base !== undefined) {
      return this.compileBaseReference(base, path)
    }

    const namespace = String(path[0])

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
  private compileBaseReference(base: AuthoredValue, path: ReferenceValue['path']): CodeFragment {
    const baseExpr = this.ctx.compileValueCode(base)

    return path.reduce<CodeFragment>(
      (acc, segment) => code`${acc}${optionalPropertyCode(String(segment))}`,
      code`(${baseExpr})`,
    )
  }

  /**
   * Resolves answers[fieldCode].current, including dynamic field-code operands.
   */
  private compileAnswerReference(path: ReferenceValue['path']): CodeFragment {
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
        : code`[String(${typeof fieldCode === 'number' ? literal(fieldCode) : this.ctx.compileValueCode(fieldCode)})]`
    let expr = code`ctx.answers${fieldAccess}?.current`

    for (let i = 2; i < path.length; i++) {
      expr = code`${expr}${optionalPropertyCode(String(path[i]))}`
    }

    return expr
  }

  /**
   * Resolves @self references against the field code supplied by the caller.
   */
  private compileSelfAnswerReference(path: ReferenceValue['path']): CodeFragment {
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
   * Resolves @loop references from the active iterator stack frame: the loop
   * item (`Loop.Item()`, and `Item()` references rewritten at AST build) and
   * loop metadata such as index, first, last, and length.
   */
  private compileIteratorLoopReference(path: ReferenceValue['path']): CodeFragment {
    if (path.length < 3) {
      return literal(undefined)
    }

    const level = typeof path[1] === 'string' ? parseInt(path[1], 10) : Number(path[1])
    const frame = this.ctx.iteratorStack[this.ctx.iteratorStack.length - 1 - level]

    if (!frame) {
      return literal(undefined)
    }

    const property = String(path[2])

    if (property === 'item') {
      return this.compileLoopItemReference(frame, path)
    }

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

  /**
   * Resolves the loop item and its sub-properties against the entries model:
   * the item is the entry value for object inputs or the element for array
   * inputs, and the '@key' segment reads the object entry key.
   */
  private compileLoopItemReference(frame: IteratorScopeFrame, path: ReferenceValue['path']): CodeFragment {
    const itemVar = toCode(frame.itemVar)

    if (path.length === 3) {
      return itemVar
    }

    const property = String(path[3])

    if (property === '@key') {
      return code`${frame.inputWasKeyedVar} ? (${toCode(frame.rawItemExpr)})[0] : undefined`
    }

    let expr = code`${itemVar}${optionalPropertyCode(property)}`

    for (let i = 4; i < path.length; i++) {
      expr = code`${expr}${optionalPropertyCode(String(path[i]))}`
    }

    return expr
  }
}

const toCode = (value: CodeFragment | IdentifierName): CodeFragment =>
  value instanceof IdentifierName ? code`${value}` : value
