import { ASTNode } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import { ExpressionType, FunctionType, IteratorType } from '../../../authoring/types/enums'
import { TemplateNode } from '../../types/template.type'
import { IteratorScopeFrame, NodeCompilationContext } from './node-compilers/types'
import ReferenceNodeCompiler from './node-compilers/ReferenceNodeCompiler'
import PredicateNodeCompiler from './node-compilers/PredicateNodeCompiler'
import PipelineNodeCompiler from './node-compilers/PipelineNodeCompiler'
import FormatNodeCompiler from './node-compilers/FormatNodeCompiler'
import ConditionalNodeCompiler from './node-compilers/ConditionalNodeCompiler'
import MatchNodeCompiler from './node-compilers/MatchNodeCompiler'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { isASTNode } from '../../typeguards/nodes'

export type { IteratorScopeFrame } from './node-compilers/types'

export default class NodeCompilationDispatcher implements NodeCompilationContext {
  private functionRegistry: FunctionRegistry | undefined

  private usedAwait = false

  private readonly iteratorFrames: IteratorScopeFrame[] = []

  private readonly selfCodeExprs: string[] = []

  private localVarCounter = 0

  private readonly references = new ReferenceNodeCompiler(this)

  private readonly predicates = new PredicateNodeCompiler(this)

  private readonly pipelines = new PipelineNodeCompiler(this)

  private readonly formats = new FormatNodeCompiler(this)

  private readonly conditionals = new ConditionalNodeCompiler(this)

  private readonly matches = new MatchNodeCompiler(this)

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

  setFunctionRegistry(functionRegistry: FunctionRegistry | undefined): void {
    this.functionRegistry = functionRegistry
  }

  reset(): void {
    this.iteratorFrames.length = 0
    this.selfCodeExprs.length = 0
    this.usedAwait = false
    this.localVarCounter = 0
  }

  pushIteratorFrame(frame: IteratorScopeFrame): void {
    this.iteratorFrames.push(frame)
  }

  popIteratorFrame(): void {
    this.iteratorFrames.pop()
  }

  withIteratorFrame<T>(frame: IteratorScopeFrame, compile: () => T): T {
    this.pushIteratorFrame(frame)

    try {
      return compile()
    } finally {
      this.popIteratorFrame()
    }
  }

  pushSelfCodeExpression(codeExpr: string): void {
    this.selfCodeExprs.push(codeExpr)
  }

  popSelfCodeExpression(): void {
    this.selfCodeExprs.pop()
  }

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

    if (node.type === ASTNodeType.PREDICATE) {
      const predicateType = (node as unknown as { predicateType: string }).predicateType

      return this.predicates.compile(predicateType, properties)
    }

    if (node.type === ASTNodeType.EXPRESSION) {
      return this.dispatchExpression((node as unknown as { expressionType: string }).expressionType, properties)
    }

    return 'undefined'
  }

  compileTemplateExpression(node: TemplateNode): string {
    const properties = (node.properties ?? {}) as Record<string, unknown>

    if (node.originalType === ASTNodeType.PREDICATE) {
      return this.predicates.compile(node.predicateType as string, properties)
    }

    if (node.originalType === ASTNodeType.EXPRESSION) {
      return this.dispatchExpression(node.expressionType as string, properties)
    }

    return 'undefined'
  }

  private dispatchExpression(expressionType: string, properties: Record<string, unknown>): string {
    switch (expressionType) {
      case ExpressionType.REFERENCE:
        return this.references.compile(properties)
      case ExpressionType.PIPELINE:
        return this.pipelines.compilePipeline(properties)
      case ExpressionType.FORMAT:
        return this.formats.compile(properties)
      case ExpressionType.ITERATE:
        return this.compileIterate(properties)
      case ExpressionType.VALIDATION:
        return this.compileValidation(properties)
      case FunctionType.CONDITION:
      case FunctionType.TRANSFORMER:
      case FunctionType.GENERATOR:
        return this.pipelines.compileFunction(properties)
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
    const resolvedBlockCodeExpr =
      properties.resolvedBlockCode !== undefined ? this.compileOperand(properties.resolvedBlockCode) : 'undefined'
    const conditionVar = this.nextLocalVar('_valid')
    const functionPrefix = this.usedAwait ? 'async ' : ''

    return `({ evaluate: ${functionPrefix}function() { var ${conditionVar}; try { ${conditionVar} = ${conditionExpr}; } catch(e) { ${conditionVar} = false; } return !!${conditionVar}; }, message: ${functionPrefix}function() { return ${messageExpr}; }, submissionOnly: ${submissionOnlyExpr}, groups: ${groupsExpr}, details: ${functionPrefix}function() { return ${detailsExpr}; }, resolvedBlockCode: ${functionPrefix}function() { return ${resolvedBlockCodeExpr}; } })`
  }

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

    this.pushIteratorFrame(frame)
    const yieldExpr = yieldTemplate !== undefined ? this.compileOperand(yieldTemplate) : 'undefined'

    this.popIteratorFrame()
    const scopedYieldExpr = this.compileScopedIteratorExpression(yieldExpr, itemVar, indexVar)

    return this.wrapIife([
      `var ${inputVar} = ${inputExpr};`,
      this.compileNormalizeIteratorInput(inputVar),
      `var ${resultVar} = [];`,
      `if (Array.isArray(${inputVar})) { for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++) { if (${rawItemExpr} == null) { continue; } ${this.compileIteratorItemScope(inputVar, indexVar, itemVar)} var ${yieldVar} = ${scopedYieldExpr}; if (${yieldVar} !== undefined) { ${resultVar}.push(${yieldVar}); } } }`,
      `return ${resultVar};`,
    ])
  }

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

    this.pushIteratorFrame(frame)
    const predicateExpr = predicateTemplate !== undefined ? this.compileOperand(predicateTemplate) : 'false'

    this.popIteratorFrame()

    return this.wrapIife([
      `var ${inputVar} = ${inputExpr};`,
      this.compileNormalizeIteratorInput(inputVar),
      `var ${resultVar} = [];`,
      `if (Array.isArray(${inputVar})) { for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++) { if (${rawItemExpr} == null) { continue; } ${this.compileIteratorItemScope(inputVar, indexVar, itemVar)} if (${predicateExpr}) { ${resultVar}.push(${rawItemExpr}); } } }`,
      `return ${resultVar};`,
    ])
  }

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

    this.pushIteratorFrame(frame)
    const predicateExpr = predicateTemplate !== undefined ? this.compileOperand(predicateTemplate) : 'false'

    this.popIteratorFrame()

    return this.wrapIife([
      `var ${inputVar} = ${inputExpr};`,
      this.compileNormalizeIteratorInput(inputVar),
      `var ${resultVar} = undefined;`,
      `if (Array.isArray(${inputVar})) { for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++) { if (${rawItemExpr} == null) { continue; } ${this.compileIteratorItemScope(inputVar, indexVar, itemVar)} if (${predicateExpr}) { ${resultVar} = ${rawItemExpr}; break; } } }`,
      `return ${resultVar};`,
    ])
  }

  private compileNormalizeIteratorInput(inputVar: string): string {
    return [
      `if (${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object") { ${inputVar} = Object.entries(${inputVar}).map(function(e) { return typeof e[1] === "object" && e[1] !== null ? Object.assign({"@key": e[0]}, e[1]) : {"@key": e[0], "@value": e[1]}; }); }`,
      `if (Array.isArray(${inputVar})) { ${inputVar} = ${inputVar}.filter(function(item) { return item != null; }); }`,
    ].join(' ')
  }

  private compileIteratorItemScope(inputVar: string, indexVar: string, itemVar: string): string {
    return `var ${itemVar} = typeof ${inputVar}[${indexVar}] === "object" && ${inputVar}[${indexVar}] !== null ? Object.assign({}, ${inputVar}[${indexVar}]) : { "@value": ${inputVar}[${indexVar}] };`
  }

  private compileScopedIteratorExpression(expr: string, itemVar: string, indexVar: string): string {
    if (this.usedAwait) {
      return `(await (async function(${itemVar}, ${indexVar}) { return ${expr}; })(${itemVar}, ${indexVar}))`
    }

    return `(function(${itemVar}, ${indexVar}) { return ${expr}; })(${itemVar}, ${indexVar})`
  }

  private wrapIife(statements: string[]): string {
    const body = statements.join(' ')

    if (this.usedAwait) {
      return `(await (async function() { ${body} })())`
    }

    return `(function() { ${body} })()`
  }

  private nextLocalVar(prefix: string): string {
    const suffix = this.localVarCounter

    this.localVarCounter += 1

    return `${prefix}${suffix}`
  }

  compileFunctionCall(funcName: string, argExprs: string[]): string {
    const callExpr = `ctx.conditions.get(${JSON.stringify(funcName)}).evaluate(${argExprs.join(', ')})`

    // Registry metadata is the source of truth for async user functions. Source
    // generation without a registry is used by narrow unit tests and preserves
    // sync output. With a registry, unknown entries are emitted as awaitable so
    // missing journey functions still fail at runtime lookup time.
    if (this.functionRegistry !== undefined && (this.functionRegistry.get(funcName)?.isAsync ?? true)) {
      this.usedAwait = true

      return `(await ${callExpr})`
    }

    return callExpr
  }

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

  isCompilableNode(value: unknown): value is ASTNode {
    return isASTNode(value) && 'id' in value
  }

  isTemplateNode(value: unknown): value is TemplateNode {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === ASTNodeType.TEMPLATE
  }
}
