import { ExpressionType, IteratorType } from '../../../authoring/types/enums'
import { ASTNode } from '../../contracts/ast/ast.type'
import { ASTNodeType } from '../../contracts/ast/enums'
import { TemplateNode } from '../../contracts/ast/template.type'
import CodeEmitter from '../emitters/CodeEmitter'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { IteratorScopeFrame } from '../expressions/types'

export interface RuntimeValueCompileOptions {
  readonly expressionErrorFallback?: string
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems?: boolean
}

export interface RuntimeValueCompilerPolicy {
  readonly expressionErrorFallback: string
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems: boolean
  readonly isStructuralValue?: (value: unknown) => boolean
  readonly compileStructuralValue?: (value: unknown, emitter: CodeEmitter, targetVar: string) => boolean
  readonly noteInlineIterator?: (nodeId: string) => void
}

type RuntimeValueErrorMode = 'fallback' | 'throw'

interface MatchBranch {
  readonly predicate?: unknown
  readonly value?: unknown
}

interface IteratorValueScope {
  readonly inputVar: string
  readonly indexVar: string
  readonly itemVar: string
  readonly rawItemExpr: string
  readonly inputLengthExpr: string
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
  private readonly expr: ExpressionDispatcher

  private readonly policy: RuntimeValueCompilerPolicy

  constructor(expr: ExpressionDispatcher, policy: RuntimeValueCompilerPolicy) {
    this.expr = expr
    this.policy = policy
  }

  /**
   * Emits assignment for one property, using a temporary value for dynamic structures.
   *
   * Static values can assign directly. Dynamic values need a stable temporary so
   * nested compilers can emit statement-shaped code before the final property
   * assignment preserves the old "assign even when undefined" behaviour.
   */
  compileAssignment(
    value: unknown,
    emitter: CodeEmitter,
    targetObj: string,
    key: string,
    options: RuntimeValueCompileOptions = {},
  ): void {
    if (this.isStaticValue(value)) {
      emitter.assign(`${targetObj}[${JSON.stringify(key)}]`, this.toLiteral(value))

      return
    }

    emitter.comment('RuntimeValueCompiler.compileAssignment')
    emitter.scope(() => {
      const resultVar = emitter.let(this.toPropertyValueVariablePrefix(key))

      this.compileValue(value, emitter, resultVar, options)
      emitter.assign(`${targetObj}[${JSON.stringify(key)}]`, resultVar)
    })
  }

  /**
   * Emits code that materialises any authored value into an existing target variable.
   */
  compileValue(
    value: unknown,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions = {},
  ): void {
    if (value === null || value === undefined) {
      emitter.assign(targetVar, this.toLiteral(value))

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

    emitter.assign(targetVar, this.toLiteral(value))
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

  /**
   * Emits expression evaluation with the configured fallback behaviour.
   */
  private compileExpressionWithCatch(
    expression: string,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const errorMode = options.expressionErrorMode ?? this.policy.expressionErrorMode ?? 'fallback'

    if (errorMode === 'throw') {
      emitter.assign(targetVar, expression)

      return
    }

    const fallback = options.expressionErrorFallback ?? this.policy.expressionErrorFallback

    emitter.tryCatch(
      () => emitter.assign(targetVar, expression),
      'error',
      () => emitter.assign(targetVar, fallback),
    )
  }

  /**
   * Emits an array value while preserving undefined-skipping policy for dynamic items.
   */
  private compileArrayValue(
    value: unknown[],
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const omitUndefined = options.omitUndefinedArrayItems ?? this.policy.omitUndefinedArrayItems

    emitter.comment('RuntimeValueCompiler.compileArrayValue')
    emitter.scope(() => {
      const arrVar = emitter.const('arrayValue', '[]')

      value.forEach(element => {
        if (this.isStaticValue(element)) {
          emitter.code(`${arrVar}.push(${this.toLiteral(element)});`)

          return
        }

        emitter.scope(() => {
          const elemVar = emitter.let('arrayItem')

          this.compileValue(element, emitter, elemVar, options)

          if (omitUndefined) {
            emitter.if(`${elemVar} !== undefined`, () => emitter.code(`${arrVar}.push(${elemVar});`))

            return
          }

          emitter.code(`${arrVar}.push(${elemVar});`)
        })
      })

      emitter.assign(targetVar, arrVar)
    })
  }

  /**
   * Emits an object value through property assignments so nested values can compile statements.
   */
  private compileObjectValue(
    value: Record<string, unknown>,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    emitter.comment('RuntimeValueCompiler.compileObjectValue')
    emitter.scope(() => {
      const objVar = emitter.const('objectValue', '{}')

      Object.entries(value).forEach(([key, entry]) => {
        this.compileAssignment(entry, emitter, objVar, key, options)
      })

      emitter.assign(targetVar, objVar)
    })
  }

  /**
   * Emits a conditional expression whose branches may need statement-shaped value compilation.
   */
  private compileConditionalValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    emitter.comment('RuntimeValueCompiler.compileConditionalValue')
    const properties = this.getProperties(node)
    const predVar = emitter.let('conditionalPredicate')

    this.compileExpressionWithCatch(this.expr.compileOperand(properties.predicate), emitter, predVar, {
      ...options,
      expressionErrorFallback: 'false',
    })

    emitter.if(
      predVar,
      () => this.compileValue(properties.thenValue, emitter, targetVar, options),
      () => this.compileValue(properties.elseValue, emitter, targetVar, options),
    )
  }

  /**
   * Emits a match expression while preserving eager predicate evaluation order.
   */
  private compileMatchValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    emitter.comment('RuntimeValueCompiler.compileMatchValue')
    const properties = this.getProperties(node)
    const branches = this.getMatchBranches(properties.branches)
    const emittedBranches = branches.map(branch => {
      const predVar = emitter.let('matchPredicate')

      this.compileExpressionWithCatch(this.expr.compileOperand(branch.predicate), emitter, predVar, {
        ...options,
        expressionErrorFallback: 'false',
      })

      return {
        condition: predVar,
        body: () => this.compileValue(branch.value, emitter, targetVar, options),
      }
    })

    emitter.ifChain(
      emittedBranches,
      properties.otherwise === undefined
        ? undefined
        : () => this.compileValue(properties.otherwise, emitter, targetVar, options),
    )
  }

  /**
   * Routes iterator expressions to their value-producing compiler.
   */
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

    emitter.assign(targetVar, 'undefined')
  }

  /**
   * Emits a MAP iterator used as a property value.
   */
  private compileMapValue(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
    options: RuntimeValueCompileOptions,
  ): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)

    emitter.comment('RuntimeValueCompiler.compileMapValue')
    emitter.scope(() => {
      const arrVar = emitter.const('mapValue', '[]')

      this.compileIteratorLoop(properties.input, emitter, () => {
        const yieldVar = emitter.let('mapItem')

        this.compileValue(iterator?.yieldTemplate, emitter, yieldVar, options)
        emitter.if(`${yieldVar} !== undefined`, () => emitter.code(`${arrVar}.push(${yieldVar});`))
      })

      emitter.assign(targetVar, arrVar)
    })
  }

  /**
   * Emits a FILTER iterator used as a property value.
   */
  private compileFilterValue(node: ASTNode | TemplateNode, emitter: CodeEmitter, targetVar: string): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)

    emitter.comment('RuntimeValueCompiler.compileFilterValue')
    emitter.scope(() => {
      const arrVar = emitter.const('filterValue', '[]')

      this.compileIteratorLoop(properties.input, emitter, scope => {
        const predVar = emitter.let('filterPredicate')

        this.compileExpressionWithCatch(this.expr.compileOperand(iterator?.predicateTemplate), emitter, predVar, {
          expressionErrorFallback: 'false',
        })
        emitter.if(predVar, () => emitter.code(`${arrVar}.push(${scope.rawItemExpr});`))
      })

      emitter.assign(targetVar, arrVar)
    })
  }

  /**
   * Emits a FIND iterator used as a property value.
   */
  private compileFindValue(node: ASTNode | TemplateNode, emitter: CodeEmitter, targetVar: string): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)

    emitter.comment('RuntimeValueCompiler.compileFindValue')
    this.compileIteratorLoop(properties.input, emitter, scope => {
      const predVar = emitter.let('findPredicate')

      this.compileExpressionWithCatch(this.expr.compileOperand(iterator?.predicateTemplate), emitter, predVar, {
        expressionErrorFallback: 'false',
      })
      emitter.if(predVar, () => {
        emitter.assign(targetVar, scope.rawItemExpr)
        emitter.break()
      })
    })
  }

  /**
   * Emits the shared iterator loop skeleton used by MAP, FILTER, and FIND value expressions.
   */
  private compileIteratorLoop(
    input: unknown,
    emitter: CodeEmitter,
    compileItem: (scope: IteratorValueScope) => void,
  ): void {
    const inputVar = emitter.let('iteratorInput', this.expr.compileOperand(input))

    this.compileNormalizeIteratorInput(inputVar, emitter)

    emitter.if(`Array.isArray(${inputVar})`, () => {
      const indexVar = emitter.let('iteratorIndex', '0')

      emitter.while(`${indexVar} < ${inputVar}.length`, () => {
        const currentIndexVar = emitter.const('currentIteratorIndex', indexVar)
        const rawItemVar = emitter.const('rawIteratorItem', `${inputVar}[${currentIndexVar}]`)

        emitter.assign(indexVar, `${indexVar} + 1`)
        emitter.if(`${rawItemVar} == null`, () => emitter.continue())

        const itemVar = emitter.const('iteratorItem', this.compileIteratorItemScope(rawItemVar))
        const inputLengthExpr = `${inputVar}.length`
        const scope: IteratorValueScope = {
          inputVar,
          indexVar: currentIndexVar,
          itemVar,
          rawItemExpr: rawItemVar,
          inputLengthExpr,
        }
        const frame: IteratorScopeFrame = {
          itemVar,
          indexVar: currentIndexVar,
          inputLengthExpr,
          rawItemExpr: rawItemVar,
        }

        this.expr.withIteratorFrame(frame, () => {
          compileItem(scope)
        })
      })
    })
  }

  /**
   * Normalizes object and array iterator inputs before MAP/FILTER/FIND loop bodies run.
   */
  private compileNormalizeIteratorInput(inputVar: string, emitter: CodeEmitter): void {
    emitter.if(`${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object"`, () => {
      emitter.assign(
        inputVar,
        `Object.entries(${inputVar}).map(function(entry) { return typeof entry[1] === "object" && entry[1] !== null ? Object.assign({"@key": entry[0]}, entry[1]) : {"@key": entry[0], "@value": entry[1]}; })`,
      )
    })
    emitter.if(`Array.isArray(${inputVar})`, () => {
      emitter.assign(inputVar, `${inputVar}.filter(function(item) { return item != null; })`)
    })
  }

  /**
   * Produces the scoped iterator item object exposed to @item references.
   */
  private compileIteratorItemScope(rawItemExpr: string): string {
    return `typeof ${rawItemExpr} === "object" && ${rawItemExpr} !== null ? Object.assign({}, ${rawItemExpr}) : { "@value": ${rawItemExpr} }`
  }

  /**
   * Reports inline iterator compilation to phase compilers that need to avoid duplicate emission.
   */
  private noteInlineIterator(node: ASTNode | TemplateNode): void {
    this.policy.noteInlineIterator?.(node.id)
  }

  /**
   * Reads expression type from registered AST nodes and template nodes using their different shapes.
   */
  private getExpressionType(node: ASTNode | TemplateNode): string | undefined {
    if (this.expr.isTemplateNode(node)) {
      return node.originalType === ASTNodeType.EXPRESSION && typeof node.expressionType === 'string'
        ? node.expressionType
        : undefined
    }

    const expressionType = (node as { expressionType?: unknown }).expressionType

    return node.type === ASTNodeType.EXPRESSION && typeof expressionType === 'string' ? expressionType : undefined
  }

  /**
   * Reads iterator configuration from a node when it has one.
   */
  private getIteratorProperties(node: ASTNode | TemplateNode): Record<string, unknown> | undefined {
    const iterator = this.getProperties(node).iterator

    return isRecord(iterator) ? iterator : undefined
  }

  /**
   * Normalizes node properties access across registered AST nodes and template nodes.
   */
  private getProperties(node: ASTNode | TemplateNode): Record<string, unknown> {
    return (node.properties ?? {}) as Record<string, unknown>
  }

  /**
   * Reads well-formed match branches while ignoring malformed authoring values.
   */
  private getMatchBranches(value: unknown): MatchBranch[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.filter(isRecord).map(branch => ({
      predicate: branch.predicate,
      value: branch.value,
    }))
  }

  /**
   * Converts JavaScript values into generated source literals.
   */
  private toLiteral(value: unknown): string {
    if (value === undefined) {
      return 'undefined'
    }

    return JSON.stringify(value) ?? 'undefined'
  }

  /**
   * Derives readable temporary names from authored property keys.
   */
  private toPropertyValueVariablePrefix(key: string): string {
    const words = key.match(/[A-Za-z0-9]+/g)?.map(word => word.toLowerCase()) ?? []

    if (words.length === 0) {
      return 'propertyValue'
    }

    const firstWord = words[0] ?? 'property'
    const restWords = words.slice(1)
    const variablePrefix = `${firstWord}${restWords.map(capitaliseWord).join('')}Value`

    if (/^[A-Za-z_$]/.test(variablePrefix)) {
      return variablePrefix
    }

    return `property${capitaliseWord(variablePrefix)}`
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

function capitaliseWord(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
