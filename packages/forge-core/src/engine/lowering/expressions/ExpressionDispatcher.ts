import { ASTNode } from '../../contracts/ast/ast.type'
import { ASTNodeType } from '../../contracts/ast/enums'
import { ExpressionType, FunctionType, IteratorType } from '../../../authoring/types/enums'
import { TemplateNode } from '../../contracts/ast/template.type'
import CodeEmitter from '../emitters/CodeEmitter'
import DiagnosticEmitter from '../emitters/DiagnosticEmitter'
import { IteratorScopeFrame, NodeCompilationContext } from './types'
import ReferenceNodeCompiler from './ReferenceNodeCompiler'
import PredicateNodeCompiler from './PredicateNodeCompiler'
import PipelineNodeCompiler from './PipelineNodeCompiler'
import ConditionalNodeCompiler from './ConditionalNodeCompiler'
import MatchNodeCompiler from './MatchNodeCompiler'
import { isASTNode } from '../../contracts/ast/nodes'
import type { CompilationDependencies } from '../compilationDependencies.type'
import { compileIifeExpression } from './IifeExpressionCompiler'

export type { IteratorScopeFrame } from './types'

const GENERATED_FUNCTION_HELPERS_PARAM = '_forgeHelpers'

/**
 * Coordinates expression-node compilers and owns transient code-generation state.
 *
 * Phase compilers use this as the single entry point for compiling AST and
 * template expressions so iterator scope, @self scope, diagnostics, and async
 * function-call discovery stay consistent across generated functions.
 */
export default class ExpressionDispatcher implements NodeCompilationContext {
  private usedAwait = false

  private readonly iteratorFrames: IteratorScopeFrame[] = []

  private readonly selfCodeExprs: string[] = []

  private localVarCounter = 0

  private readonly references = new ReferenceNodeCompiler(this)

  private readonly predicates = new PredicateNodeCompiler(this)

  private readonly pipelines = new PipelineNodeCompiler(this)

  private readonly conditionals = new ConditionalNodeCompiler(this)

  private readonly matches = new MatchNodeCompiler(this)

  private readonly diagnostics = new DiagnosticEmitter()

  constructor(private readonly dependencies: CompilationDependencies) {}

  get iteratorStack(): readonly IteratorScopeFrame[] {
    return this.iteratorFrames
  }

  get iteratorDepth(): number {
    return this.iteratorFrames.length
  }

  get selfCodeExpr(): string | undefined {
    return this.selfCodeExprs[this.selfCodeExprs.length - 1]
  }

  get usesAwait(): boolean {
    return this.usedAwait
  }

  markAsAsync(): void {
    this.usedAwait = true
  }

  saveState(): {
    usedAwait: boolean
    iteratorFrames: IteratorScopeFrame[]
    selfCodeExprs: string[]
    localVarCounter: number
  } {
    return {
      usedAwait: this.usedAwait,
      iteratorFrames: [...this.iteratorFrames],
      selfCodeExprs: [...this.selfCodeExprs],
      localVarCounter: this.localVarCounter,
    }
  }

  restoreState(state: {
    usedAwait: boolean
    iteratorFrames: IteratorScopeFrame[]
    selfCodeExprs: string[]
    localVarCounter: number
  }): void {
    this.usedAwait = state.usedAwait
    this.iteratorFrames.length = 0
    this.iteratorFrames.push(...state.iteratorFrames)
    this.selfCodeExprs.length = 0
    this.selfCodeExprs.push(...state.selfCodeExprs)
    this.localVarCounter = state.localVarCounter
  }

  /**
   * Clears per-function generation state before a phase compiler builds source.
   */
  reset(): void {
    this.iteratorFrames.length = 0
    this.selfCodeExprs.length = 0
    this.usedAwait = false
    this.localVarCounter = 0
  }

  /**
   * Compiles a nested expression with @scope and @loop bound to an iterator frame.
   */
  withIteratorFrame<T>(frame: IteratorScopeFrame, compile: () => T): T {
    this.iteratorFrames.push(frame)

    try {
      return compile()
    } finally {
      this.iteratorFrames.pop()
    }
  }

  /**
   * Adds the current field-code expression for @self answer references.
   */
  pushSelfCodeExpression(codeExpr: string): void {
    this.selfCodeExprs.push(codeExpr)
  }

  /**
   * Removes the current @self field-code expression.
   */
  popSelfCodeExpression(): void {
    this.selfCodeExprs.pop()
  }

  /**
   * Compiles a nested expression with @self bound when a field code is known.
   */
  withSelfCodeExpression<T>(codeExpr: string | undefined, compile: () => T): T {
    if (codeExpr === undefined) {
      return compile()
    }

    this.pushSelfCodeExpression(codeExpr)

    try {
      return compile()
    } finally {
      this.popSelfCodeExpression()
    }
  }

  /**
   * Registered AST nodes and iterator template nodes share the same expression
   * compilers. Keeping the dispatch split here lets render, validation, answer
   * prep, reachability, and hooks all use one scope and async model.
   */
  compileExpression(node: ASTNode): string {
    if (!this.isCompilableNode(node)) {
      return JSON.stringify(node)
    }

    const properties = (node as unknown as { properties: Record<string, unknown> }).properties ?? {}
    let expressionType: string | undefined
    let expression = 'undefined'

    if (node.type === ASTNodeType.PREDICATE) {
      const predicateType = (node as unknown as { predicateType: string }).predicateType

      expression = this.predicates.compile(predicateType, properties)
    } else if (node.type === ASTNodeType.EXPRESSION) {
      expressionType = (node as unknown as { expressionType: string }).expressionType

      expression = this.dispatchExpression(expressionType, properties, node)
    }

    if (this.isDirectFunctionExpression(expressionType)) {
      return expression
    }

    return this.diagnostics.wrapExpression(expression, node, this.usedAwait)
  }

  /**
   * Compiles template-embedded expression nodes using the same scope model as registered AST nodes.
   */
  compileTemplateExpression(node: TemplateNode): string {
    const properties = (node.properties ?? {}) as Record<string, unknown>
    let expressionType: string | undefined
    let expression = 'undefined'

    if (node.originalType === ASTNodeType.PREDICATE) {
      expression = this.predicates.compile(node.predicateType as string, properties)
    } else if (node.originalType === ASTNodeType.EXPRESSION) {
      expressionType = node.expressionType as string
      expression = this.dispatchExpression(expressionType, properties, node)
    }

    if (this.isDirectFunctionExpression(expressionType)) {
      return expression
    }

    return this.diagnostics.wrapExpression(expression, node, this.usedAwait)
  }

  private isDirectFunctionExpression(expressionType: string | undefined): boolean {
    // Function calls carry their own diagnostic metadata through evaluateFunction,
    // so wrapping the same node again only makes generated source noisier.
    return expressionType === FunctionType.CONDITION ||
      expressionType === FunctionType.TRANSFORMER ||
      expressionType === FunctionType.GENERATOR
  }

  private dispatchExpression(expressionType: string, properties: Record<string, unknown>, source?: unknown): string {
    switch (expressionType) {
      case ExpressionType.REFERENCE:
        return this.references.compile(properties)
      case ExpressionType.PIPELINE:
        return this.pipelines.compilePipeline(properties)
      case ExpressionType.ITERATE:
        return this.compileIterate(properties)
      case ExpressionType.VALIDATION:
        return this.compileValidation(properties)
      case FunctionType.CONDITION:
      case FunctionType.TRANSFORMER:
      case FunctionType.GENERATOR:
        return this.pipelines.compileFunction(properties, source)
      case ExpressionType.CONDITIONAL:
        return this.conditionals.compile(properties)
      case ExpressionType.MATCH:
        return this.matches.compile(properties)
      default:
        return 'undefined'
    }
  }

  /**
   * Operands can be plain data, registered nodes, template nodes, or nested
   * containers containing any of those. Compiling them recursively here keeps
   * function arguments and block properties on the same rules.
   */
  compileOperand(value: unknown): string {
    if (this.isTemplateNode(value)) {
      return this.compileTemplateExpression(value)
    }

    if (this.isCompilableNode(value)) {
      return this.compileExpression(value as ASTNode)
    }

    if (Array.isArray(value)) {
      return `[${value.map(entry => this.compileOperand(entry)).join(', ')}]`
    }

    if (value !== null && value !== undefined && typeof value === 'object') {
      const properties = Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => `${JSON.stringify(key)}: ${this.compileOperand(entry)}`)

      return `({ ${properties.join(', ')} })`
    }

    if (value === undefined) {
      return 'undefined'
    }

    return JSON.stringify(value)
  }

  /**
   * Dispatches authored iterators to expression-level MAP, FILTER, and FIND emitters.
   */
  private compileIterate(properties: Record<string, unknown>): string {
    const iterator = properties.iterator as
      | {
          type?: unknown
          yieldTemplate?: unknown
          predicateTemplate?: unknown
        }
      | undefined

    if (iterator?.type === IteratorType.MAP) {
      return this.compileMapIterator(properties.input, iterator.yieldTemplate)
    }

    if (iterator?.type === IteratorType.FILTER) {
      return this.compileFilterIterator(properties.input, iterator.predicateTemplate)
    }

    if (iterator?.type === IteratorType.FIND) {
      return this.compileFindIterator(properties.input, iterator.predicateTemplate)
    }

    return 'undefined'
  }

  /**
   * Builds the validation result object used by field and domain validation slots.
   */
  private compileValidation(properties: Record<string, unknown>): string {
    const condition = properties.condition

    if (condition === undefined) {
      return 'undefined'
    }

    const conditionExpr = this.compileOperand(condition)
    const messageExpr = properties.message !== undefined ? this.compileOperand(properties.message) : JSON.stringify('')
    const submissionOnlyExpr = properties.submissionOnly === true ? 'true' : 'false'
    const groupsExpr = properties.groups !== undefined ? this.compileOperand(properties.groups) : 'undefined'
    const detailsExpr = properties.details !== undefined ? this.compileOperand(properties.details) : 'undefined'
    const conditionHelperName = this.usedAwait ? 'evaluateValidationConditionAsync' : 'evaluateValidationCondition'
    const conditionHelperExpr = `${GENERATED_FUNCTION_HELPERS_PARAM}.${conditionHelperName}(\n${this.indentSource(this.compileReturnFunction(conditionExpr))}\n)`

    return [
      '({',
      this.indentSource(
        [
          `evaluate: ${this.compileReturnFunction(conditionHelperExpr)},`,
          `message: ${this.compileReturnFunction(messageExpr)},`,
          `submissionOnly: ${submissionOnlyExpr},`,
          `groups: ${groupsExpr},`,
          `details: ${this.compileReturnFunction(detailsExpr)}`,
        ].join('\n'),
      ),
      '})',
    ].join('\n')
  }

  /**
   * Emits expression-level map iteration when a template value needs a returned array.
   */
  private compileMapIterator(input: unknown, yieldTemplate: unknown): string {
    const inputExpr = this.compileOperand(input)
    const inputVar = this.nextLocalVar('_input')
    const resultVar = this.nextLocalVar('_result')
    const indexVar = this.nextLocalVar('_idx')
    const itemVar = this.nextLocalVar('_item')
    const yieldVar = this.nextLocalVar('_yield')
    const rawItemExpr = `${inputVar}[${indexVar}]`
    const frame: IteratorScopeFrame = {
      itemVar,
      indexVar,
      inputLengthExpr: `${inputVar}.length`,
      rawItemExpr,
    }

    const yieldExpr = this.withIteratorFrame(frame, () =>
      yieldTemplate !== undefined ? this.compileOperand(yieldTemplate) : 'undefined',
    )
    const scopedYieldExpr = this.compileScopedIteratorExpression(yieldExpr, itemVar, indexVar)

    return compileIifeExpression({
      awaitResult: this.usedAwait,
      isAsync: this.usedAwait,
      compileBody: emitter => {
        emitter.declareLet(inputVar, inputExpr)
        this.compileNormalizeIteratorInput(inputVar, emitter)
        emitter.declareConst(resultVar, '[]')
        this.compileIteratorArrayLoop(inputVar, indexVar, rawItemExpr, emitter, () => {
          this.compileIteratorItemScope(rawItemExpr, itemVar, emitter)
          emitter.declareConst(yieldVar, scopedYieldExpr)
          emitter.if(`${yieldVar} !== undefined`, () => {
            emitter.code(`${resultVar}.push(${yieldVar});`)
          })
        })
        emitter.return(resultVar)
      },
    })
  }

  /**
   * Emits expression-level filter iteration while preserving iterator scope references.
   */
  private compileFilterIterator(input: unknown, predicateTemplate: unknown): string {
    const inputExpr = this.compileOperand(input)
    const inputVar = this.nextLocalVar('_input')
    const resultVar = this.nextLocalVar('_result')
    const indexVar = this.nextLocalVar('_idx')
    const itemVar = this.nextLocalVar('_item')
    const rawItemExpr = `${inputVar}[${indexVar}]`
    const frame: IteratorScopeFrame = {
      itemVar,
      indexVar,
      inputLengthExpr: `${inputVar}.length`,
      rawItemExpr,
    }

    const predicateExpr = this.withIteratorFrame(frame, () =>
      predicateTemplate !== undefined ? this.compileOperand(predicateTemplate) : 'false',
    )

    return compileIifeExpression({
      awaitResult: this.usedAwait,
      isAsync: this.usedAwait,
      compileBody: emitter => {
        emitter.declareLet(inputVar, inputExpr)

        this.compileNormalizeIteratorInput(inputVar, emitter)

        emitter.declareConst(resultVar, '[]')

        this.compileIteratorArrayLoop(inputVar, indexVar, rawItemExpr, emitter, () => {
          this.compileIteratorItemScope(rawItemExpr, itemVar, emitter)

          emitter.if(predicateExpr, () => {
            emitter.code(`${resultVar}.push(${rawItemExpr});`)
          })
        })

        emitter.return(resultVar)
      },
    })
  }

  /**
   * Emits expression-level find iteration with the first matching item as the result.
   */
  private compileFindIterator(input: unknown, predicateTemplate: unknown): string {
    const inputExpr = this.compileOperand(input)
    const inputVar = this.nextLocalVar('_input')
    const resultVar = this.nextLocalVar('_result')
    const indexVar = this.nextLocalVar('_idx')
    const itemVar = this.nextLocalVar('_item')
    const rawItemExpr = `${inputVar}[${indexVar}]`
    const frame: IteratorScopeFrame = {
      itemVar,
      indexVar,
      inputLengthExpr: `${inputVar}.length`,
      rawItemExpr,
    }

    const predicateExpr = this.withIteratorFrame(frame, () =>
      predicateTemplate !== undefined ? this.compileOperand(predicateTemplate) : 'false',
    )

    return compileIifeExpression({
      awaitResult: this.usedAwait,
      isAsync: this.usedAwait,
      compileBody: emitter => {
        emitter.declareLet(inputVar, inputExpr)

        this.compileNormalizeIteratorInput(inputVar, emitter)

        emitter.declareLet(resultVar, 'undefined')

        this.compileIteratorArrayLoop(inputVar, indexVar, rawItemExpr, emitter, () => {
          this.compileIteratorItemScope(rawItemExpr, itemVar, emitter)

          emitter.if(predicateExpr, () => {
            emitter.assign(resultVar, rawItemExpr)
            emitter.break()
          })
        })

        emitter.return(resultVar)
      },
    })
  }

  /**
   * Normalizes object inputs to keyed items so iterator templates can use @key and @value.
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
   * Creates the per-item object exposed to @scope references inside iterator templates.
   */
  private compileIteratorItemScope(rawItemExpr: string, itemVar: string, emitter: CodeEmitter): void {
    emitter.declareConst(
      itemVar,
      `typeof ${rawItemExpr} === "object" && ${rawItemExpr} !== null ? Object.assign({}, ${rawItemExpr}) : { "@value": ${rawItemExpr} }`,
    )
  }

  /**
   * Isolates iterator expressions so local item and index variables cannot leak outward.
   */
  private compileScopedIteratorExpression(expr: string, itemVar: string, indexVar: string): string {
    return compileIifeExpression({
      args: [itemVar, indexVar],
      awaitResult: this.usedAwait,
      isAsync: this.usedAwait,
      params: [itemVar, indexVar],
      compileBody: emitter => {
        if (this.usedAwait) {
          emitter.return(`await (${expr})`)
        } else {
          emitter.return(`(${expr})`)
        }
      },
    })
  }

  private compileIteratorArrayLoop(
    inputVar: string,
    indexVar: string,
    rawItemExpr: string,
    emitter: CodeEmitter,
    compileItem: () => void,
  ): void {
    emitter.if(`Array.isArray(${inputVar})`, () => {
      emitter.code(`for (let ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++) {`)
      emitter.indent()

      try {
        emitter.if(`${rawItemExpr} == null`, () => {
          emitter.continue()
        })

        compileItem()
      } finally {
        emitter.dedent()
      }

      emitter.code('}')
    })
  }

  /**
   * Allocates collision-resistant local names for expression-level IIFEs.
   */
  private nextLocalVar(prefix: string): string {
    const suffix = this.localVarCounter

    this.localVarCounter += 1

    return `${prefix}${suffix}`
  }

  /**
   * Emits a registered function call through shared helpers when diagnostics are available.
   */
  compileFunctionCall(funcName: string, argExprs: string[], source?: unknown): string {
    const callIsAsync = this.dependencies.functionRegistry.get(funcName)?.isAsync ?? true

    if (callIsAsync) {
      this.usedAwait = true
    }

    const helperName = callIsAsync ? 'evaluateFunctionAsync' : 'evaluateFunction'
    const helperCall = this.diagnostics.wrapFunctionCall(helperName, funcName, argExprs, source)

    if (helperCall === undefined) {
      const callExpr = `ctx.conditions.get(${JSON.stringify(funcName)}).evaluate(${argExprs.join(', ')})`

      if (callIsAsync) {
        return `(await ${callExpr})`
      }

      return callExpr
    }

    if (callIsAsync) {
      return `(await ${helperCall})`
    }

    return helperCall
  }

  private indentSource(source: string): string {
    return source
      .split('\n')
      .map(line => (line.length === 0 ? line : `  ${line}`))
      .join('\n')
  }

  private compileReturnFunction(expression: string): string {
    const functionPrefix = this.usedAwait ? 'async ' : ''
    const awaitKeyword = this.usedAwait ? 'await ' : ''

    return `${functionPrefix}function() {\n${this.indentSource(`return ${awaitKeyword}${expression};`)}\n}`
  }

  /**
   * Maps top-level DSL reference namespaces to their runtime context objects.
   */
  namespaceToCtx(namespace: string): string {
    switch (namespace) {
      case 'data':
        return 'ctx.data'
      case 'session':
        return 'ctx.session'
      case 'params':
        return 'ctx.params'
      case 'query':
        return 'ctx.query'
      case 'request':
        return 'ctx.request'
      case 'post':
        return 'ctx.post'
      default:
        return `ctx[${JSON.stringify(namespace)}]`
    }
  }

  /**
   * Identifies registry-backed AST nodes that can be compiled as expressions.
   */
  isCompilableNode(value: unknown): value is ASTNode {
    return isASTNode(value) && 'id' in value
  }

  /**
   * Identifies template-wrapped nodes embedded inside authored values.
   */
  isTemplateNode(value: unknown): value is TemplateNode {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === ASTNodeType.TEMPLATE
  }
}
