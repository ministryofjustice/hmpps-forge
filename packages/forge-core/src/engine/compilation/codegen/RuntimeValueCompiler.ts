import { ExpressionType, IteratorType } from '../../../authoring/types/enums'
import { ASTNode } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import { TemplateNode } from '../../types/template.type'
import CodeEmitter from './CodeEmitter'
import NodeCompilationDispatcher from './NodeCompilationDispatcher'
import ScopedTemplateCompiler, { IteratorCompileScope } from './ScopedTemplateCompiler'

export interface RuntimeValueCompileOptions {
  readonly expressionErrorFallback?: string
  readonly omitUndefinedArrayItems?: boolean
}

export interface RuntimeValueCompilerPolicy {
  readonly expressionErrorFallback: string
  readonly omitUndefinedArrayItems: boolean
  readonly isStructuralValue?: (value: unknown) => boolean
  readonly compileStructuralValue?: (value: unknown, emitter: CodeEmitter, targetVar: string) => boolean
  readonly noteInlineIterator?: (nodeId: string) => void
}

interface MatchBranch {
  readonly predicate?: unknown
  readonly value?: unknown
}

/**
 * Materialises authored values into generated runtime values.
 *
 * The expression dispatcher handles inline expressions. This class handles the
 * statement-shaped cases around them: arrays, objects, conditional branches,
 * matches, and iterators whose yielded values may themselves contain structures
 * a domain compiler wants to own.
 */
export default class RuntimeValueCompiler {
  private readonly expr: NodeCompilationDispatcher

  private readonly policy: RuntimeValueCompilerPolicy

  private readonly templates: ScopedTemplateCompiler

  constructor(expr: NodeCompilationDispatcher, policy: RuntimeValueCompilerPolicy) {
    this.expr = expr
    this.policy = policy
    this.templates = new ScopedTemplateCompiler(expr)
  }

  compileAssignment(
    value: unknown,
    emitter: CodeEmitter,
    targetObj: string,
    key: string,
    options: RuntimeValueCompileOptions = {},
  ): void {
    if (this.isStaticValue(value)) {
      emitter.emit(`${targetObj}[${JSON.stringify(key)}] = ${this.toLiteral(value)};`)

      return
    }

    const resultVar = emitter.nextVar('_v')

    emitter.emit(`var ${resultVar};`)
    this.compileValue(value, emitter, resultVar, options)
    emitter.emit(`${targetObj}[${JSON.stringify(key)}] = ${resultVar};`)
  }

  compileValue(
    value: unknown,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions = {},
  ): void {
    if (value === null || value === undefined) {
      emitter.emit(`${targetVar} = ${this.toLiteral(value)};`)

      return
    }

    if (this.policy.compileStructuralValue?.(value, emitter, targetVar) === true) {
      return
    }

    if (this.expr.isTemplateNode(value)) {
      this.compileNodeValue(value, emitter, targetVar, options)

      return
    }

    if (this.expr.isCompilableNode(value)) {
      this.compileNodeValue(value, emitter, targetVar, options)

      return
    }

    if (Array.isArray(value)) {
      this.compileArrayValue(value, emitter, targetVar, options)

      return
    }

    if (isRecord(value)) {
      this.compileObjectValue(value, emitter, targetVar, options)

      return
    }

    emitter.emit(`${targetVar} = ${this.toLiteral(value)};`)
  }

  isStaticValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true
    }

    if (typeof value !== 'object') {
      return true
    }

    if (this.policy.isStructuralValue?.(value) === true) {
      return false
    }

    if (this.expr.isCompilableNode(value) || this.expr.isTemplateNode(value)) {
      return false
    }

    if (Array.isArray(value)) {
      return value.every(item => this.isStaticValue(item))
    }

    return Object.values(value as Record<string, unknown>).every(item => this.isStaticValue(item))
  }

  private compileNodeValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const expressionType = this.getExpressionType(node)

    if (expressionType === ExpressionType.CONDITIONAL) {
      this.compileConditionalValue(node, emitter, targetVar, options)

      return
    }

    if (expressionType === ExpressionType.MATCH) {
      this.compileMatchValue(node, emitter, targetVar, options)

      return
    }

    if (expressionType === ExpressionType.ITERATE) {
      this.compileIterateValue(node, emitter, targetVar, options)

      return
    }

    if (this.expr.isTemplateNode(node)) {
      this.compileExpressionWithCatch(this.expr.compileTemplateExpression(node), emitter, targetVar, options)

      return
    }

    this.compileExpressionWithCatch(this.expr.compileExpression(node), emitter, targetVar, options)
  }

  private compileExpressionWithCatch(
    expression: string,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const fallback = options.expressionErrorFallback ?? this.policy.expressionErrorFallback

    emitter.emitBlock('try', () => {
      emitter.emit(`${targetVar} = ${expression};`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${targetVar} = ${fallback};`)
    })
  }

  private compileArrayValue(
    value: unknown[],
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const arrVar = emitter.nextVar('_arr')
    const omitUndefined = options.omitUndefinedArrayItems ?? this.policy.omitUndefinedArrayItems

    emitter.emit(`var ${arrVar} = [];`)

    value.forEach(element => {
      if (this.isStaticValue(element)) {
        emitter.emit(`${arrVar}.push(${this.toLiteral(element)});`)

        return
      }

      const elemVar = emitter.nextVar('_elem')

      emitter.emit(`var ${elemVar};`)
      this.compileValue(element, emitter, elemVar, options)

      if (omitUndefined) {
        emitter.emitBlock(`if (${elemVar} !== undefined)`, () => {
          emitter.emit(`${arrVar}.push(${elemVar});`)
        })

        return
      }

      emitter.emit(`${arrVar}.push(${elemVar});`)
    })

    emitter.emit(`${targetVar} = ${arrVar};`)
  }

  private compileObjectValue(
    value: Record<string, unknown>,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const objVar = emitter.nextVar('_obj')

    emitter.emit(`var ${objVar} = {};`)
    Object.entries(value).forEach(([key, entry]) => {
      this.compileAssignment(entry, emitter, objVar, key, options)
    })
    emitter.emit(`${targetVar} = ${objVar};`)
  }

  private compileConditionalValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const properties = this.getProperties(node)
    const predVar = emitter.nextVar('_pred')

    emitter.emit(`var ${predVar};`)
    this.compileExpressionWithCatch(this.expr.compileOperand(properties.predicate), emitter, predVar, {
      ...options,
      expressionErrorFallback: 'false',
    })

    emitter.emitBlock(`if (${predVar})`, () => {
      this.compileValue(properties.thenValue, emitter, targetVar, options)
    })
    emitter.emitBlock('else', () => {
      this.compileValue(properties.elseValue, emitter, targetVar, options)
    })
  }

  private compileMatchValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const properties = this.getProperties(node)
    const branches = this.getMatchBranches(properties.branches)
    const predicateVars = branches.map(() => emitter.nextVar('_mpred'))

    branches.forEach((branch, index) => {
      const predVar = predicateVars[index]

      emitter.emit(`var ${predVar};`)
      this.compileExpressionWithCatch(this.expr.compileOperand(branch.predicate), emitter, predVar, {
        ...options,
        expressionErrorFallback: 'false',
      })
    })

    branches.forEach((branch, index) => {
      const predVar = predicateVars[index]
      const keyword = index === 0 ? `if (${predVar})` : `else if (${predVar})`

      emitter.emitBlock(keyword, () => {
        this.compileValue(branch.value, emitter, targetVar, options)
      })
    })

    if (properties.otherwise === undefined) {
      return
    }

    if (branches.length === 0) {
      this.compileValue(properties.otherwise, emitter, targetVar, options)

      return
    }

    emitter.emitBlock('else', () => {
      this.compileValue(properties.otherwise, emitter, targetVar, options)
    })
  }

  private compileIterateValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const iterator = this.getIteratorProperties(node)

    this.noteInlineIterator(node)

    if (iterator?.type === IteratorType.MAP) {
      this.compileMapValue(node, emitter, targetVar, options)

      return
    }

    if (iterator?.type === IteratorType.FILTER) {
      this.compileFilterValue(node, emitter, targetVar)

      return
    }

    if (iterator?.type === IteratorType.FIND) {
      this.compileFindValue(node, emitter, targetVar)

      return
    }

    emitter.emit(`${targetVar} = undefined;`)
  }

  private compileMapValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)
    const arrVar = emitter.nextVar('_marr')

    emitter.emit(`var ${arrVar} = [];`)
    this.templates.compileIteratorLoop(properties.input, emitter, scope => {
      const yieldVar = emitter.nextVar('_yield')

      this.compileScopedMapYield(iterator?.yieldTemplate, emitter, yieldVar, scope, options)
      emitter.emitBlock(`if (${yieldVar} !== undefined)`, () => {
        emitter.emit(`${arrVar}.push(${yieldVar});`)
      })
    })
    emitter.emit(`${targetVar} = ${arrVar};`)
  }

  private compileScopedMapYield(
    yieldTemplate: unknown,
    emitter: CodeEmitter,
    yieldVar: string,
    scope: IteratorCompileScope,
    options: RuntimeValueCompileOptions,
  ): void {
    const bodyEmitter = emitter.fork()
    const scopedValueVar = bodyEmitter.nextVar('_yieldValue')

    bodyEmitter.emit(`var ${scopedValueVar};`)
    this.compileValue(yieldTemplate, bodyEmitter, scopedValueVar, options)
    bodyEmitter.emit(`return ${scopedValueVar};`)
    emitter.syncVariablesFrom(bodyEmitter)

    const awaitKeyword = this.expr.usesAwait ? 'await ' : ''
    const functionPrefix = this.expr.usesAwait ? 'async ' : ''

    emitter.emit(`var ${yieldVar} = ${awaitKeyword}(${functionPrefix}function(${scope.itemVar}, ${scope.indexVar}) {`)
    emitter.indent()
    bodyEmitter
      .toString()
      .split('\n')
      .forEach(line => {
        if (line.length === 0) {
          emitter.emitBlank()

          return
        }

        emitter.emit(line)
      })
    emitter.dedent()
    emitter.emit(`})(${scope.itemVar}, ${scope.indexVar});`)
  }

  private compileFilterValue(node: ASTNode | TemplateNode, emitter: CodeEmitter, targetVar: string): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)
    const arrVar = emitter.nextVar('_farr')

    emitter.emit(`var ${arrVar} = [];`)
    this.templates.compileIteratorLoop(properties.input, emitter, scope => {
      const predVar = emitter.nextVar('_fpred')

      emitter.emit(`var ${predVar};`)
      this.compileExpressionWithCatch(this.expr.compileOperand(iterator?.predicateTemplate), emitter, predVar, {
        expressionErrorFallback: 'false',
      })
      emitter.emitBlock(`if (${predVar})`, () => {
        emitter.emit(`${arrVar}.push(${scope.rawItemExpr});`)
      })
    })
    emitter.emit(`${targetVar} = ${arrVar};`)
  }

  private compileFindValue(node: ASTNode | TemplateNode, emitter: CodeEmitter, targetVar: string): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)

    this.templates.compileIteratorLoop(properties.input, emitter, scope => {
      const predVar = emitter.nextVar('_fpred')

      emitter.emit(`var ${predVar};`)
      this.compileExpressionWithCatch(this.expr.compileOperand(iterator?.predicateTemplate), emitter, predVar, {
        expressionErrorFallback: 'false',
      })
      emitter.emitBlock(`if (${predVar})`, () => {
        emitter.emit(`${targetVar} = ${scope.rawItemExpr}; break;`)
      })
    })
  }

  private noteInlineIterator(node: ASTNode | TemplateNode): void {
    const id = this.getNodeId(node)

    if (id === undefined) {
      return
    }

    this.policy.noteInlineIterator?.(id)
  }

  private getExpressionType(node: ASTNode | TemplateNode): string | undefined {
    if (this.expr.isTemplateNode(node)) {
      return node.originalType === ASTNodeType.EXPRESSION && typeof node.expressionType === 'string'
        ? node.expressionType
        : undefined
    }

    const expressionType = (node as { expressionType?: unknown }).expressionType

    return node.type === ASTNodeType.EXPRESSION && typeof expressionType === 'string' ? expressionType : undefined
  }

  private getIteratorProperties(node: ASTNode | TemplateNode): Record<string, unknown> | undefined {
    const iterator = this.getProperties(node).iterator

    return isRecord(iterator) ? iterator : undefined
  }

  private getProperties(node: ASTNode | TemplateNode): Record<string, unknown> {
    return (node.properties ?? {}) as Record<string, unknown>
  }

  private getMatchBranches(value: unknown): MatchBranch[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.filter(isRecord).map(branch => ({
      predicate: branch.predicate,
      value: branch.value,
    }))
  }

  private getNodeId(node: ASTNode | TemplateNode): string | undefined {
    return typeof node.id === 'string' ? node.id : undefined
  }

  private toLiteral(value: unknown): string {
    if (value === undefined) {
      return 'undefined'
    }

    return JSON.stringify(value) ?? 'undefined'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}
