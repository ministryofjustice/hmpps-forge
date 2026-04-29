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
import { getDSLSourceMetadata, type DSLPathSegment } from '../../diagnostics/sourceMetadata'

export type { IteratorScopeFrame } from './node-compilers/types'

interface DiagnosticMetadata {
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

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
    let expression = 'undefined'

    if (node.type === ASTNodeType.PREDICATE) {
      const predicateType = (node as unknown as { predicateType: string }).predicateType

      expression = this.predicates.compile(predicateType, properties)
    } else if (node.type === ASTNodeType.EXPRESSION) {
      const expressionType = (node as unknown as { expressionType: string }).expressionType

      expression = this.dispatchExpression(expressionType, properties, node)
    }

    return this.compileTrackedExpression(node, expression)
  }

  compileTemplateExpression(node: TemplateNode): string {
    const properties = (node.properties ?? {}) as Record<string, unknown>
    let expression = 'undefined'

    if (node.originalType === ASTNodeType.PREDICATE) {
      expression = this.predicates.compile(node.predicateType as string, properties)
    } else if (node.originalType === ASTNodeType.EXPRESSION) {
      expression = this.dispatchExpression(node.expressionType as string, properties, node)
    }

    return this.compileTrackedExpression(node, expression)
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

    return `({ evaluate: ${functionPrefix}function() { var ${conditionVar}; try { ${conditionVar} = ${conditionExpr}; } catch(e) { if (e instanceof TypeError || (e && e.cause instanceof TypeError && e.functionType === ${JSON.stringify(FunctionType.CONDITION)})) { ${conditionVar} = false; } else { throw e; } } return !!${conditionVar}; }, message: ${functionPrefix}function() { return ${messageExpr}; }, submissionOnly: ${submissionOnlyExpr}, groups: ${groupsExpr}, details: ${functionPrefix}function() { return ${detailsExpr}; }, resolvedBlockCode: ${functionPrefix}function() { return ${resolvedBlockCodeExpr}; } })`
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

    const argVars = argExprs.map(() => this.nextLocalVar('_arg'))
    const argAssignments = argExprs.map((argExpr, index) => `var ${argVars[index]} = ${argExpr};`)
    const callExpr = `ctx.conditions.get(${JSON.stringify(funcName)}).evaluate(${argVars.join(', ')})`
    const returnStatement = callIsAsync ? `return await ${callExpr};` : `return ${callExpr};`

    return this.wrapTrackedIife(metadata, argAssignments, returnStatement)
  }

  private compileTrackedExpression(source: unknown, expression: string): string {
    const metadata = this.getDiagnosticMetadata(source)

    if (metadata === undefined) {
      return expression
    }

    const returnStatement = this.usedAwait ? `return await (${expression});` : `return (${expression});`

    return this.wrapTrackedIife(metadata, [], returnStatement)
  }

  private wrapTrackedIife(
    metadata: DiagnosticMetadata,
    setupStatements: readonly string[],
    returnStatement: string,
  ): string {
    const prevNodeIdVar = this.nextLocalVar('_prevForgeNodeId')
    const prevDslPathVar = this.nextLocalVar('_prevForgeDslPath')
    const prevFormattedPathVar = this.nextLocalVar('_prevForgeFormattedPath')
    const prevFunctionNameVar = this.nextLocalVar('_prevForgeFunctionName')
    const prevFunctionTypeVar = this.nextLocalVar('_prevForgeFunctionType')
    const prevDiagnosticsVar = this.nextLocalVar('_prevForgeDiagnostics')
    const setup = setupStatements.length > 0 ? `${setupStatements.join(' ')} ` : ''
    const body = [
      setup,
      `var ${prevNodeIdVar} = typeof _forgeNodeId === "undefined" ? undefined : _forgeNodeId;`,
      `var ${prevDslPathVar} = typeof _forgeDslPath === "undefined" ? undefined : _forgeDslPath;`,
      `var ${prevFormattedPathVar} = typeof _forgeFormattedPath === "undefined" ? undefined : _forgeFormattedPath;`,
      `var ${prevFunctionNameVar} = typeof _forgeFunctionName === "undefined" ? undefined : _forgeFunctionName;`,
      `var ${prevFunctionTypeVar} = typeof _forgeFunctionType === "undefined" ? undefined : _forgeFunctionType;`,
      `var ${prevDiagnosticsVar} = typeof _forgeRuntimeDiagnostics === "undefined" ? undefined : _forgeRuntimeDiagnostics.current;`,
      this.compileDiagnosticAssignments(metadata),
      `try { ${returnStatement} } catch(e) { ${this.compileDiagnosticThrow(metadata)} } finally { ${this.compileDiagnosticRestore(
        prevNodeIdVar,
        prevDslPathVar,
        prevFormattedPathVar,
        prevFunctionNameVar,
        prevFunctionTypeVar,
        prevDiagnosticsVar,
      )} }`,
    ].join(' ')

    if (this.usedAwait) {
      return `(await (async function() { ${body} })())`
    }

    return `(function() { ${body} })()`
  }

  private compileDiagnosticAssignments(metadata: DiagnosticMetadata): string {
    return [
      `if (typeof _forgeNodeId !== "undefined") { _forgeNodeId = ${this.toSourceLiteral(metadata.nodeId)}; }`,
      `if (typeof _forgeDslPath !== "undefined") { _forgeDslPath = ${this.toSourceLiteral(metadata.path)}; }`,
      `if (typeof _forgeFormattedPath !== "undefined") { _forgeFormattedPath = ${this.toSourceLiteral(metadata.formattedPath)}; }`,
      `if (typeof _forgeFunctionName !== "undefined") { _forgeFunctionName = ${this.toSourceLiteral(metadata.functionName)}; }`,
      `if (typeof _forgeFunctionType !== "undefined") { _forgeFunctionType = ${this.toSourceLiteral(metadata.functionType)}; }`,
      `if (typeof _forgeRuntimeDiagnostics !== "undefined") { _forgeRuntimeDiagnostics.current = { nodeId: ${this.toSourceLiteral(
        metadata.nodeId,
      )}, path: ${this.toSourceLiteral(metadata.path)}, formattedPath: ${this.toSourceLiteral(
        metadata.formattedPath,
      )}, functionName: ${this.toSourceLiteral(metadata.functionName)}, functionType: ${this.toSourceLiteral(
        metadata.functionType,
      )} }; }`,
    ].join(' ')
  }

  private compileDiagnosticThrow(metadata: DiagnosticMetadata): string {
    return `if (typeof _forgeRuntimeDiagnostics !== "undefined") { throw _forgeRuntimeDiagnostics.wrap(e, ${this.toSourceLiteral(
      metadata.nodeId,
    )}, ${this.toSourceLiteral(metadata.path)}, ${this.toSourceLiteral(
      metadata.formattedPath,
    )}, ${this.toSourceLiteral(metadata.functionName)}, ${this.toSourceLiteral(metadata.functionType)}); } throw e;`
  }

  private compileDiagnosticRestore(
    prevNodeIdVar: string,
    prevDslPathVar: string,
    prevFormattedPathVar: string,
    prevFunctionNameVar: string,
    prevFunctionTypeVar: string,
    prevDiagnosticsVar: string,
  ): string {
    return [
      `if (typeof _forgeNodeId !== "undefined") { _forgeNodeId = ${prevNodeIdVar}; }`,
      `if (typeof _forgeDslPath !== "undefined") { _forgeDslPath = ${prevDslPathVar}; }`,
      `if (typeof _forgeFormattedPath !== "undefined") { _forgeFormattedPath = ${prevFormattedPathVar}; }`,
      `if (typeof _forgeFunctionName !== "undefined") { _forgeFunctionName = ${prevFunctionNameVar}; }`,
      `if (typeof _forgeFunctionType !== "undefined") { _forgeFunctionType = ${prevFunctionTypeVar}; }`,
      `if (typeof _forgeRuntimeDiagnostics !== "undefined") { _forgeRuntimeDiagnostics.current = ${prevDiagnosticsVar}; }`,
    ].join(' ')
  }

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
    const sourceMetadata = getDSLSourceMetadata(source)

    if (!this.isRecord(source)) {
      return {
        path: sourceMetadata?.dslPath,
        formattedPath: sourceMetadata?.formattedDslPath,
      }
    }

    const dslPath = source.dslPath
    const path = this.isDSLPath(dslPath) ? dslPath : sourceMetadata?.dslPath
    const formattedPath =
      typeof source.formattedDslPath === 'string' ? source.formattedDslPath : sourceMetadata?.formattedDslPath

    return {
      nodeId: typeof source.id === 'string' ? source.id : undefined,
      path,
      formattedPath,
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

  private isDSLPath(value: unknown): value is readonly DSLPathSegment[] {
    return Array.isArray(value) && value.every(segment => typeof segment === 'string' || typeof segment === 'number')
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
