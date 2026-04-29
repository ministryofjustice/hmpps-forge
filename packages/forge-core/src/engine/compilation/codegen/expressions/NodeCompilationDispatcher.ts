import { ASTNode } from '../../../types/ast.type'
import { ASTNodeType } from '../../../types/enums'
import { ExpressionType, FunctionType, IteratorType } from '../../../../authoring/types/enums'
import { TemplateNode } from '../../../types/template.type'
import { IteratorScopeFrame, NodeCompilationContext } from './types'
import ReferenceNodeCompiler from './ReferenceNodeCompiler'
import PredicateNodeCompiler from './PredicateNodeCompiler'
import PipelineNodeCompiler from './PipelineNodeCompiler'
import FormatNodeCompiler from './FormatNodeCompiler'
import ConditionalNodeCompiler from './ConditionalNodeCompiler'
import MatchNodeCompiler from './MatchNodeCompiler'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import { isASTNode } from '../../../typeguards/nodes'
import { getDSLSourceMetadata, type DSLPathSegment } from '../../../diagnostics/sourceMetadata'

export type { IteratorScopeFrame } from './types'

interface DiagnosticMetadata {
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

const GENERATED_FUNCTION_HELPERS_PARAM = '_forgeHelpers'
const RUNTIME_DIAGNOSTICS_PARAM = '_forgeRuntimeDiagnostics'

/**
 * Coordinates expression-node compilers and owns transient code-generation state.
 *
 * Phase compilers use this as the single entry point for compiling AST and
 * template expressions so iterator scope, @self scope, diagnostics, and async
 * function-call discovery stay consistent across generated functions.
 */
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

  /**
   * Supplies authored-function metadata so generated source can choose sync or async calls.
   */
  setFunctionRegistry(functionRegistry: FunctionRegistry | undefined): void {
    this.functionRegistry = functionRegistry
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
   * Adds an iterator frame for compilers that manage the scope lifetime themselves.
   */
  pushIteratorFrame(frame: IteratorScopeFrame): void {
    this.iteratorFrames.push(frame)
  }

  /**
   * Removes the current iterator frame after its nested expression has compiled.
   */
  popIteratorFrame(): void {
    this.iteratorFrames.pop()
  }

  /**
   * Compiles a nested expression with @scope and @loop bound to an iterator frame.
   */
  withIteratorFrame<T>(frame: IteratorScopeFrame, compile: () => T): T {
    this.pushIteratorFrame(frame)

    try {
      return compile()
    } finally {
      this.popIteratorFrame()
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

    return this.compileTrackedExpression(node, expression)
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

    return this.compileTrackedExpression(node, expression)
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
      case ExpressionType.FORMAT:
        return this.formats.compile(properties)
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

  /**
   * Normalizes object inputs to keyed items so iterator templates can use @key and @value.
   */
  private compileNormalizeIteratorInput(inputVar: string): string {
    return [
      `if (${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object") { ${inputVar} = Object.entries(${inputVar}).map(function(e) { return typeof e[1] === "object" && e[1] !== null ? Object.assign({"@key": e[0]}, e[1]) : {"@key": e[0], "@value": e[1]}; }); }`,
      `if (Array.isArray(${inputVar})) { ${inputVar} = ${inputVar}.filter(function(item) { return item != null; }); }`,
    ].join(' ')
  }

  /**
   * Creates the per-item object exposed to @scope references inside iterator templates.
   */
  private compileIteratorItemScope(inputVar: string, indexVar: string, itemVar: string): string {
    return `var ${itemVar} = typeof ${inputVar}[${indexVar}] === "object" && ${inputVar}[${indexVar}] !== null ? Object.assign({}, ${inputVar}[${indexVar}]) : { "@value": ${inputVar}[${indexVar}] };`
  }

  /**
   * Isolates iterator expressions so local item and index variables cannot leak outward.
   */
  private compileScopedIteratorExpression(expr: string, itemVar: string, indexVar: string): string {
    if (this.usedAwait) {
      return `(await (async function(${itemVar}, ${indexVar}) { return ${expr}; })(${itemVar}, ${indexVar}))`
    }

    return `(function(${itemVar}, ${indexVar}) { return ${expr}; })(${itemVar}, ${indexVar})`
  }

  /**
   * Wraps expression-only iterator lowering in an IIFE so it can return a value.
   */
  private wrapIife(statements: string[]): string {
    const body = statements.join(' ')

    if (this.usedAwait) {
      return `(await (async function() { ${body} })())`
    }

    return `(function() { ${body} })()`
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
    const callIsAsync = this.functionRegistry !== undefined && (this.functionRegistry.get(funcName)?.isAsync ?? true)

    // Registry metadata is the source of truth for async user functions. Source
    // generation without a registry is used by narrow unit tests and preserves
    // sync output. With a registry, unknown entries are emitted as awaitable so
    // missing journey functions still fail at runtime lookup time.
    if (callIsAsync) {
      this.usedAwait = true
    }

    const metadata = this.getDiagnosticMetadata(source, funcName)

    if (metadata === undefined) {
      const callExpr = `ctx.conditions.get(${JSON.stringify(funcName)}).evaluate(${argExprs.join(', ')})`

      if (callIsAsync) {
        return `(await ${callExpr})`
      }

      return callExpr
    }

    const helperName = callIsAsync ? 'evaluateFunctionAsync' : 'evaluateFunction'
    const helperCall = this.compileDiagnosticHelperCall(helperName, metadata, funcName, argExprs)

    if (callIsAsync) {
      return `(await ${helperCall})`
    }

    return helperCall
  }

  /**
   * Wraps non-function expressions with node metadata so runtime errors keep DSL context.
   */
  private compileTrackedExpression(source: unknown, expression: string): string {
    const metadata = this.getDiagnosticMetadata(source)

    if (metadata === undefined) {
      return expression
    }

    const returnStatement = this.usedAwait ? `return await (${expression});` : `return (${expression});`
    const helperName = this.usedAwait ? 'evaluateTrackedAsync' : 'evaluateTracked'
    const callbackPrefix = this.usedAwait ? 'async ' : ''
    const helperCall = this.compileTrackedHelperCall(helperName, metadata, callbackPrefix, returnStatement)

    if (this.usedAwait) {
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

  private compileRuntimeDiagnosticsArg(): string {
    return `typeof ${RUNTIME_DIAGNOSTICS_PARAM} === "undefined" ? undefined : ${RUNTIME_DIAGNOSTICS_PARAM}`
  }

  private compileTrackedHelperCall(
    helperName: string,
    metadata: DiagnosticMetadata,
    callbackPrefix: string,
    returnStatement: string,
  ): string {
    const callback = `${callbackPrefix}function() {\n${this.indentSource(returnStatement)}\n}`
    const args = [this.compileRuntimeDiagnosticsArg(), this.compileDiagnosticMetadataLiteral(metadata), callback]

    return `${GENERATED_FUNCTION_HELPERS_PARAM}.${helperName}(\n${this.indentSource(args.join(',\n'))}\n)`
  }

  private compileDiagnosticHelperCall(
    helperName: string,
    metadata: DiagnosticMetadata,
    funcName: string,
    argExprs: string[],
  ): string {
    const args = [
      'ctx',
      this.compileRuntimeDiagnosticsArg(),
      this.compileDiagnosticMetadataLiteral(metadata),
      JSON.stringify(funcName),
      `[${argExprs.join(', ')}]`,
    ]

    return `${GENERATED_FUNCTION_HELPERS_PARAM}.${helperName}(\n${this.indentSource(args.join(',\n'))}\n)`
  }

  private compileReturnFunction(expression: string): string {
    const functionPrefix = this.usedAwait ? 'async ' : ''
    const awaitKeyword = this.usedAwait ? 'await ' : ''

    return `${functionPrefix}function() {\n${this.indentSource(`return ${awaitKeyword}${expression};`)}\n}`
  }

  private compileDiagnosticMetadataLiteral(metadata: DiagnosticMetadata): string {
    return [
      '{',
      this.indentSource(
        [
          `nodeId: ${this.toSourceLiteral(metadata.nodeId)},`,
          `path: ${this.toSourceLiteral(metadata.path)},`,
          `formattedPath: ${this.toSourceLiteral(metadata.formattedPath)},`,
          `functionName: ${this.toSourceLiteral(metadata.functionName)},`,
          `functionType: ${this.toSourceLiteral(metadata.functionType)}`,
        ].join('\n'),
      ),
      '}',
    ].join('\n')
  }

  /**
   * Pulls together node and function metadata for generated runtime diagnostics.
   */
  private getDiagnosticMetadata(source: unknown, functionName?: string): DiagnosticMetadata | undefined {
    const sourceMetadata = this.getSourceMetadata(source)
    const resolvedFunctionName = functionName ?? this.getFunctionName(source)
    const functionType = this.getFunctionType(source)

    if (
      sourceMetadata.nodeId === undefined &&
      sourceMetadata.path === undefined &&
      sourceMetadata.formattedPath === undefined &&
      resolvedFunctionName === undefined &&
      functionType === undefined
    ) {
      return undefined
    }

    return {
      ...sourceMetadata,
      functionName: resolvedFunctionName,
      functionType,
    }
  }

  private getSourceMetadata(source: unknown): DiagnosticMetadata {
    const metadata = getDSLSourceMetadata(source)

    if (!this.isRecord(source)) {
      return {
        path: metadata?.dslPath,
        formattedPath: metadata?.formattedDslPath,
      }
    }

    return {
      nodeId: typeof source.id === 'string' ? source.id : undefined,
      path: metadata?.dslPath,
      formattedPath: metadata?.formattedDslPath,
    }
  }

  private getFunctionName(source: unknown): string | undefined {
    if (!this.isRecord(source)) {
      return undefined
    }

    const properties = this.isRecord(source.properties) ? source.properties : source
    const name = properties.name

    return typeof name === 'string' ? name : undefined
  }

  private getFunctionType(source: unknown): string | undefined {
    if (!this.isRecord(source)) {
      return undefined
    }

    const expressionType = source.expressionType

    switch (expressionType) {
      case FunctionType.CONDITION:
      case FunctionType.TRANSFORMER:
      case FunctionType.GENERATOR:
      case FunctionType.EFFECT:
        return expressionType
      default:
        return undefined
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  }

  private toSourceLiteral(value: unknown): string {
    if (value === undefined) {
      return 'undefined'
    }

    return JSON.stringify(value) ?? 'undefined'
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
