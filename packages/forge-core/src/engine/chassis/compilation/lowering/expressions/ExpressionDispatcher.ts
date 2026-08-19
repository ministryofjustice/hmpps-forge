import { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, FunctionType, IteratorType } from '../../../../../authoring/types/enums'
import { TemplateNode } from '../../../contracts/ast/template.type'
import ForgeUnregisteredFunctionError from '../../../../errors/ForgeUnregisteredFunctionError'
import {
  CodeFragment,
  arrayCode,
  code,
  literal,
  objectCode,
  ObjectCodeProperty,
  SafeCode,
} from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'
import DiagnosticEmitter, { type DiagnosticMetadata } from '../emitters/DiagnosticEmitter'
import { FunctionCallCompileOptions, IteratorScopeFrame, NodeCompilationContext } from './types'
import ReferenceNodeCompiler from './ReferenceNodeCompiler'
import PredicateNodeCompiler from './PredicateNodeCompiler'
import PipelineNodeCompiler from './PipelineNodeCompiler'
import ConditionalNodeCompiler from './ConditionalNodeCompiler'
import MatchNodeCompiler from './MatchNodeCompiler'
import { isASTNode } from '../../../contracts/ast/nodes'
import { isDeepStaticValue } from '../../../contracts/models/authoredValue.type'
import type { CompilationDependencies } from '../compilationDependencies.type'
import { compileIifeExpression } from './IifeExpressionCompiler'

export type { IteratorScopeFrame } from './types'

/**
 * Coordinates the individual expression-node compilers and owns the temporary
 * state accumulated while generating a single function.
 *
 * Concern compilers (e.g. validation, reachability, hooks) use this as the
 * single entry point for compiling AST and template expressions. Routing
 * everything through here keeps iterator scope, `@self` scope, diagnostics,
 * and async function-call discovery consistent across generated functions.
 */
export default class ExpressionDispatcher implements NodeCompilationContext {
  private readonly iteratorFrames: IteratorScopeFrame[] = []

  private readonly selfCodeExprs: CodeFragment[] = []

  private readonly validationFunctionPrefixes: string[] = []

  /**
   * Function bodies that sequential call statements may be emitted into.
   * `undefined` entries mark positions where hoisting is unsafe (conditional
   * evaluation or a nested function scope); see `withoutCallHoisting`.
   */
  private readonly callHoistingScopes: (CodeGenerator | undefined)[] = []

  private readonly references = new ReferenceNodeCompiler(this)

  private readonly predicates = new PredicateNodeCompiler(this)

  private readonly pipelines = new PipelineNodeCompiler(this)

  private readonly conditionals = new ConditionalNodeCompiler(this)

  private readonly matches = new MatchNodeCompiler(this)

  private readonly diagnostics = new DiagnosticEmitter()

  private usedAwait = false

  private fragmentGenerator = new CodeGenerator()

  constructor(private readonly dependencies: CompilationDependencies) {}

  get iteratorStack(): readonly IteratorScopeFrame[] {
    return this.iteratorFrames
  }

  get iteratorDepth(): number {
    return this.iteratorFrames.length
  }

  get selfCodeExpr(): CodeFragment | undefined {
    return this.selfCodeExprs[this.selfCodeExprs.length - 1]
  }

  get usesAwait(): boolean {
    return this.usedAwait
  }

  get generator(): CodeGenerator {
    return this.fragmentGenerator
  }

  get diagnosticCatalogue(): readonly DiagnosticMetadata[] {
    return this.diagnostics.snapshot()
  }

  /**
   * Compiles a nested function body under its own await tracking and reports
   * whether that body emitted an `await`. An await inside a nested function
   * makes that function async, not the enclosing one, so the enclosing
   * function's flag is restored afterwards.
   */
  trackNestedFunctionAwait(compileBody: () => void): boolean {
    const enclosingUsedAwait = this.usedAwait

    this.usedAwait = false

    try {
      compileBody()

      return this.usedAwait
    } finally {
      this.usedAwait = enclosingUsedAwait
    }
  }

  /**
   * Clears per-function generation state so a concern compiler can start fresh.
   */
  reset(): void {
    this.iteratorFrames.length = 0
    this.selfCodeExprs.length = 0
    this.validationFunctionPrefixes.length = 0
    this.callHoistingScopes.length = 0
    this.diagnostics.reset()
    this.usedAwait = false
    this.fragmentGenerator = new CodeGenerator()
  }

  /**
   * Compiles an expression whose statements may be emitted directly into
   * `bodyGenerator`: function calls hoist their argument consts as statements
   * and reduce to a bare call instead of wrapping themselves in an IIFE.
   *
   * Only safe when everything compiled inside `compile` is evaluated exactly
   * once, unconditionally, in source order, within `bodyGenerator`'s scope.
   * Compilers that break any of those guarantees for a sub-expression must
   * clear the scope with `withoutCallHoisting`.
   */
  withCallHoistingScope<T>(bodyGenerator: CodeGenerator, compile: () => T): T {
    this.callHoistingScopes.push(bodyGenerator)

    try {
      return compile()
    } finally {
      this.callHoistingScopes.pop()
    }
  }

  /**
   * Compiles a sub-expression with call hoisting disabled — used for positions
   * that evaluate conditionally (`&&`/`||` operands, ternary branches) or
   * inside a nested function scope (pipeline steps, iterator bodies), where a
   * hoisted statement would run eagerly or reference out-of-scope variables.
   */
  withoutCallHoisting<T>(compile: () => T): T {
    this.callHoistingScopes.push(undefined)

    try {
      return compile()
    } finally {
      this.callHoistingScopes.pop()
    }
  }

  private get callHoistingScope(): CodeGenerator | undefined {
    return this.callHoistingScopes[this.callHoistingScopes.length - 1]
  }

  /**
   * Compiles a nested expression with `@scope` and `@loop` bound to an iterator
   * frame (the item, index, and length variables for one level of iteration).
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
  pushSelfCodeExpression(codeExpr: CodeFragment): void {
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
  withSelfCodeExpression<T>(codeExpr: SafeCode | undefined, compile: () => T): T {
    if (codeExpr === undefined) {
      return compile()
    }

    const typedCodeExpression = codeExpr instanceof IdentifierName ? code`${codeExpr}` : codeExpr

    this.pushSelfCodeExpression(typedCodeExpression)

    try {
      return compile()
    } finally {
      this.popSelfCodeExpression()
    }
  }

  /**
   * Gives validation callbacks a stable developer-facing identity while their
   * authored value (the raw value a journey author wrote) is compiled into
   * generated code through the shared runtime-value compiler.
   */
  withValidationFunctionPrefix<T>(prefix: string, compile: () => T): T {
    this.validationFunctionPrefixes.push(prefix)

    try {
      return compile()
    } finally {
      this.validationFunctionPrefixes.pop()
    }
  }

  /**
   * Registered AST nodes and iterator template nodes (expression nodes
   * embedded inside authored templates) share the same expression compilers.
   * Keeping the dispatch split here lets render, validation, answer prep,
   * reachability, and hooks all use one scope and async model.
   */
  compileExpressionCode(node: ASTNode): CodeFragment {
    if (!this.isCompilableNode(node)) {
      return literal(node)
    }

    const properties = (node as unknown as { properties: Record<string, unknown> }).properties ?? {}
    let expressionType: string | undefined
    let expression = literal(undefined)

    if (node.type === ASTNodeType.PREDICATE) {
      const predicateType = (node as unknown as { predicateType: string }).predicateType

      expression = this.predicates.compile(predicateType, properties)
    } else if (node.type === ASTNodeType.EXPRESSION) {
      expressionType = (node as unknown as { expressionType: string }).expressionType

      expression = this.dispatchExpression(expressionType, properties, node)
    }

    if (this.hasOwnDiagnosticBoundary(expressionType) || this.isValidationPredicate(node.type)) {
      return expression
    }

    if (this.isThrowFreeReference(expressionType, expression)) {
      return this.diagnostics.attachPositions(expression, node)
    }

    return this.diagnostics.wrapExpression(expression, node, this.usedAwait, this.generator)
  }

  /**
   * Compiles expression nodes found inside templates, using the same scope
   * and dispatch logic as top-level AST nodes.
   */
  compileTemplateExpressionCode(node: TemplateNode): CodeFragment {
    const properties = (node.properties ?? {}) as Record<string, unknown>
    let expressionType: string | undefined
    let expression = literal(undefined)

    if (node.originalType === ASTNodeType.PREDICATE) {
      expression = this.predicates.compile(node.predicateType as string, properties)
    } else if (node.originalType === ASTNodeType.EXPRESSION) {
      expressionType = node.expressionType as string
      expression = this.dispatchExpression(expressionType, properties, node)
    }

    if (this.hasOwnDiagnosticBoundary(expressionType) || this.isValidationPredicate(node.originalType)) {
      return expression
    }

    if (this.isThrowFreeReference(expressionType, expression)) {
      return this.diagnostics.attachPositions(expression, node)
    }

    return this.diagnostics.wrapExpression(expression, node, this.usedAwait, this.generator)
  }

  /**
   * Reference chains compile to `?.`-guarded property reads, so unless a
   * dynamic segment introduced a call they cannot throw. Tracking them through
   * `evaluateTracked` would allocate a callback purely to attribute an error
   * that can never happen.
   */
  private isThrowFreeReference(expressionType: string | undefined, expression: CodeFragment): boolean {
    return expressionType === ExpressionType.REFERENCE && !expression.containsInvocation
  }

  private hasOwnDiagnosticBoundary(expressionType: string | undefined): boolean {
    // Function calls carry their own diagnostic metadata through evaluateFunction.
    // Validation rules contain tracked operands and function calls, so wrapping
    // the rule object itself only adds an unrelated callback around construction.
    return expressionType === FunctionType.CONDITION ||
      expressionType === FunctionType.TRANSFORMER ||
      expressionType === FunctionType.GENERATOR ||
      expressionType === ExpressionType.VALIDATION
  }

  private isValidationPredicate(nodeType: unknown): boolean {
    // Predicate leaves already carry diagnostics through their references and
    // registered function calls. Keep their boolean composition visible inside
    // the named validation condition instead of wrapping the whole predicate.
    return this.validationFunctionPrefixes.length > 0 && nodeType === ASTNodeType.PREDICATE
  }

  private dispatchExpression(
    expressionType: string,
    properties: Record<string, unknown>,
    source?: unknown,
  ): CodeFragment {
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
        return literal(undefined)
    }
  }

  /**
   * Operands can be plain data, registered nodes, template nodes, or nested
   * containers containing any of those. Compiling them recursively here keeps
   * function arguments and block properties on the same rules.
   */
  compileOperandCode(value: unknown): CodeFragment {
    if (this.isTemplateNode(value)) {
      return this.compileTemplateExpressionCode(value)
    }

    if (this.isCompilableNode(value)) {
      return this.compileExpressionCode(value as ASTNode)
    }

    if (Array.isArray(value)) {
      return arrayCode(value.map(entry => this.compileOperandCode(entry)))
    }

    if (value !== null && value !== undefined && typeof value === 'object') {
      const properties = Object.entries(value as Record<string, unknown>).map(([key, entry]) => ({
        key,
        value: this.compileOperandCode(entry),
      }))

      return code`(${objectCode(properties)})`
    }

    if (value === undefined) {
      return literal(undefined)
    }

    return literal(value)
  }

  /**
   * Dispatches authored iterators to the MAP, FILTER, and FIND compilers,
   * each of which produces a JavaScript expression (not statements).
   */
  private compileIterate(properties: Record<string, unknown>): CodeFragment {
    const iterator = properties.iterator as
      | {
          type?: unknown
          yieldTemplate?: unknown
          predicateTemplate?: unknown
        }
      | undefined

    // Iterator input and templates compile into the iterator's own IIFE scope
    // and loop body, so statements must not hoist past that boundary.
    return this.withoutCallHoisting(() => {
      if (iterator?.type === IteratorType.MAP) {
        return this.compileMapIterator(properties.input, iterator.yieldTemplate)
      }

      if (iterator?.type === IteratorType.FILTER) {
        return this.compileFilterIterator(properties.input, iterator.predicateTemplate)
      }

      if (iterator?.type === IteratorType.FIND) {
        return this.compileFindIterator(properties.input, iterator.predicateTemplate)
      }

      return literal(undefined)
    })
  }

  /**
   * Builds the validation result object used by field-level and journey-level
   * validation rules.
   */
  private compileValidation(properties: Record<string, unknown>): CodeFragment {
    const condition = properties.condition

    if (condition === undefined) {
      return literal(undefined)
    }

    const messageValue = properties.message
    const detailsValue = properties.details
    const functionPrefix = this.validationFunctionPrefixes[this.validationFunctionPrefixes.length - 1] ?? 'validation'
    const validationCondition = this.compileReturnFunctionExpression(
      () => this.compileOperandCode(condition),
      `evaluate_${functionPrefix}_condition`,
    )
    const message = this.isStaticOperand(messageValue)
      ? this.compileStaticOperand(messageValue, literal(''))
      : this.compileReturnFunctionExpression(
          () => this.compileOperandCode(messageValue),
          `evaluate_${functionPrefix}_message`,
        )
    const ruleProperties: ObjectCodeProperty[] = [
      { key: 'condition', value: validationCondition },
      { key: 'message', value: message },
      { key: 'submissionOnly', value: literal(properties.submissionOnly === true) },
    ]

    if (properties.groups !== undefined) {
      ruleProperties.push({ key: 'groups', value: this.compileOperandCode(properties.groups) })
    }

    if (detailsValue !== undefined) {
      const details = this.isStaticOperand(detailsValue)
        ? this.compileStaticOperand(detailsValue, literal(undefined))
        : this.compileReturnFunctionExpression(
            () => this.compileOperandCode(detailsValue),
            `evaluate_${functionPrefix}_details`,
          )

      ruleProperties.push({ key: 'details', value: details })
    }

    return objectCode(ruleProperties)
  }

  /**
   * Compiles a map iterator into a JavaScript expression that builds an array
   * by evaluating the yield template for each input item.
   */
  private compileMapIterator(input: unknown, yieldTemplate: unknown): CodeFragment {
    const inputExpr = this.compileOperandCode(input)

    return compileIifeExpression({
      awaitResult: () => this.usedAwait,
      generator: this.generator,
      isAsync: () => this.usedAwait,
      name: 'map_iterator',
      compileBody: generator => {
        const inputVar = generator.let('_input', inputExpr)

        this.compileNormalizeIteratorInput(inputVar, generator)

        const resultVar = generator.const('_result', arrayCode([]))

        this.compileIteratorArrayLoop(inputVar, generator, (indexVar, rawItemExpr) => {
          const itemVar = this.compileIteratorItemScope(rawItemExpr, generator)
          const frame: IteratorScopeFrame = {
            itemVar,
            indexVar,
            inputLengthExpr: code`${inputVar}.length`,
            rawItemExpr,
          }
          const yieldExpr = this.withIteratorFrame(frame, () =>
            yieldTemplate !== undefined ? this.compileOperandCode(yieldTemplate) : literal(undefined),
          )
          const scopedYieldExpr = this.compileScopedIteratorExpression(yieldExpr, itemVar, indexVar, generator)
          const yieldVar = generator.const('_yield', scopedYieldExpr)

          generator.if(code`${yieldVar} !== undefined`, () => {
            generator.statement(code`${resultVar}.push(${yieldVar})`)
          })
        })
        generator.return(resultVar)
      },
    })
  }

  /**
   * Compiles a filter iterator into a JavaScript expression that keeps only
   * items matching the predicate template.
   */
  private compileFilterIterator(input: unknown, predicateTemplate: unknown): CodeFragment {
    const inputExpr = this.compileOperandCode(input)

    return compileIifeExpression({
      awaitResult: () => this.usedAwait,
      generator: this.generator,
      isAsync: () => this.usedAwait,
      name: 'filter_iterator',
      compileBody: generator => {
        const inputVar = generator.let('_input', inputExpr)

        this.compileNormalizeIteratorInput(inputVar, generator)

        const resultVar = generator.const('_result', arrayCode([]))

        this.compileIteratorArrayLoop(inputVar, generator, (indexVar, rawItemExpr) => {
          const itemVar = this.compileIteratorItemScope(rawItemExpr, generator)
          const frame: IteratorScopeFrame = {
            itemVar,
            indexVar,
            inputLengthExpr: code`${inputVar}.length`,
            rawItemExpr,
          }
          const predicateExpr = this.withIteratorFrame(frame, () =>
            predicateTemplate !== undefined ? this.compileOperandCode(predicateTemplate) : literal(false),
          )

          generator.if(predicateExpr, () => {
            generator.statement(code`${resultVar}.push(${rawItemExpr})`)
          })
        })

        generator.return(resultVar)
      },
    })
  }

  /**
   * Compiles a find iterator into a JavaScript expression that returns the
   * first item matching the predicate template.
   */
  private compileFindIterator(input: unknown, predicateTemplate: unknown): CodeFragment {
    const inputExpr = this.compileOperandCode(input)

    return compileIifeExpression({
      awaitResult: () => this.usedAwait,
      generator: this.generator,
      isAsync: () => this.usedAwait,
      name: 'find_iterator',
      compileBody: generator => {
        const inputVar = generator.let('_input', inputExpr)

        this.compileNormalizeIteratorInput(inputVar, generator)

        const resultVar = generator.let('_result', literal(undefined))

        this.compileIteratorArrayLoop(inputVar, generator, (indexVar, rawItemExpr) => {
          const itemVar = this.compileIteratorItemScope(rawItemExpr, generator)
          const frame: IteratorScopeFrame = {
            itemVar,
            indexVar,
            inputLengthExpr: code`${inputVar}.length`,
            rawItemExpr,
          }
          const predicateExpr = this.withIteratorFrame(frame, () =>
            predicateTemplate !== undefined ? this.compileOperandCode(predicateTemplate) : literal(false),
          )

          generator.if(predicateExpr, () => {
            generator.assign(resultVar, rawItemExpr)
            generator.break()
          })
        })

        generator.return(resultVar)
      },
    })
  }

  /**
   * Normalizes object inputs to keyed items so iterator templates can use @key
   * and @value. Shared with `IteratorLoopEmitter` so both iterator code paths
   * emit the same normalisation under the same generated names.
   */
  compileNormalizeIteratorInput(inputVar: IdentifierName, generator: CodeGenerator): void {
    generator.if(code`${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object"`, () => {
      const mapEntry = generator.functionExpression(
        'normaliseIteratorEntry',
        ['entry'],
        (callbackGenerator, [entry]) => {
          const keyedObject = objectCode([{ key: '@key', value: code`${entry}[0]` }])
          const scalarObject = objectCode([
            { key: '@key', value: code`${entry}[0]` },
            { key: '@value', value: code`${entry}[1]` },
          ])

          callbackGenerator.return(
            code`typeof ${entry}[1] === "object" && ${entry}[1] !== null ? Object.assign(${keyedObject}, ${entry}[1]) : ${scalarObject}`,
          )
        },
      )

      generator.assign(inputVar, code`Object.entries(${inputVar}).map(${mapEntry})`)
    })

    generator.if(code`Array.isArray(${inputVar})`, () => {
      const keepItem = generator.functionExpression('keepIteratorItem', ['item'], (callbackGenerator, [item]) => {
        callbackGenerator.return(code`${item} != null`)
      })

      generator.assign(inputVar, code`${inputVar}.filter(${keepItem})`)
    })
  }

  /**
   * Produces the per-item object exposed to @scope and `Item()` references.
   * Shared with `IteratorLoopEmitter` for the same reason as normalisation.
   */
  compileIteratorItemScopeExpression(rawItemExpr: CodeFragment | IdentifierName): CodeFragment {
    return code`typeof ${rawItemExpr} === "object" && ${rawItemExpr} !== null ? Object.assign({}, ${rawItemExpr}) : ${objectCode([{ key: '@value', value: rawItemExpr }])}`
  }

  private compileIteratorItemScope(rawItemExpr: CodeFragment, generator: CodeGenerator): IdentifierName {
    return generator.const('_item', this.compileIteratorItemScopeExpression(rawItemExpr))
  }

  /**
   * Isolates iterator expressions so local item and index variables cannot leak outward.
   */
  private compileScopedIteratorExpression(
    expr: CodeFragment,
    itemVar: IdentifierName,
    indexVar: IdentifierName,
    generator: CodeGenerator,
  ): CodeFragment {
    return compileIifeExpression({
      args: [code`${itemVar}`, code`${indexVar}`],
      awaitResult: () => this.usedAwait,
      generator,
      isAsync: () => this.usedAwait,
      name: 'evaluate_iterator_item',
      params: [itemVar.value, indexVar.value],
      compileBody: callbackGenerator => {
        if (this.usedAwait) {
          callbackGenerator.return(code`await (${expr})`)
        } else {
          callbackGenerator.return(code`(${expr})`)
        }
      },
    })
  }

  private compileIteratorArrayLoop(
    inputVar: IdentifierName,
    generator: CodeGenerator,
    compileItem: (indexVar: IdentifierName, rawItemExpr: CodeFragment) => void,
  ): void {
    generator.if(code`Array.isArray(${inputVar})`, () => {
      generator.forRange('_index', literal(0), code`${inputVar}.length`, indexVar => {
        const rawItemExpr = code`${inputVar}[${indexVar}]`

        generator.if(code`${rawItemExpr} == null`, () => {
          generator.continue()
        })

        compileItem(indexVar, rawItemExpr)
      })
    })
  }

  compileFunctionCallCode(
    funcName: string,
    argExprs: readonly CodeFragment[],
    source?: unknown,
    options: FunctionCallCompileOptions = {},
  ): CodeFragment {
    const registeredFunction = this.dependencies.functionRegistry.get(funcName)

    if (!registeredFunction) {
      throw new ForgeUnregisteredFunctionError({
        functionName: funcName,
        functionType: (source as { expressionType?: string } | undefined)?.expressionType ?? 'unknown',
      })
    }

    const callIsAsync = registeredFunction.isAsync

    if (callIsAsync) {
      this.usedAwait = true
    }

    const helperName = callIsAsync ? 'evaluateFunctionAsync' : 'evaluateFunction'
    const validationPrefix = this.validationFunctionPrefixes[this.validationFunctionPrefixes.length - 1]

    if (validationPrefix !== undefined) {
      return this.compileDebuggableValidationFunctionCall(
        helperName,
        funcName,
        argExprs,
        source,
        validationPrefix,
        options,
        callIsAsync,
      )
    }

    const helperCall = this.diagnostics.wrapFunctionCall(helperName, funcName, argExprs, source)

    if (callIsAsync) {
      return code`(await ${helperCall})`
    }

    return helperCall
  }

  private compileDebuggableValidationFunctionCall(
    helperName: string,
    funcName: string,
    argExprs: readonly CodeFragment[],
    source: unknown,
    validationPrefix: string,
    options: FunctionCallCompileOptions,
    callIsAsync: boolean,
  ): CodeFragment {
    const hoistingScope = this.callHoistingScope
    // Flattening is restricted to calls whose arguments contain no further
    // invocations: hoisting an argument that itself calls authored code could
    // reorder it against sibling calls, where the inline IIFE cannot.
    const argumentsAreInvocationFree = argExprs.every(argument => !argument.containsInvocation)

    if (hoistingScope !== undefined && argumentsAreInvocationFree) {
      const helperCall = this.compileNamedArgumentHelperCall(helperName, funcName, argExprs, source, options, scope =>
        hoistingScope.const(scope.prefix, scope.argument),
      )

      return callIsAsync ? code`(await ${helperCall})` : helperCall
    }

    const functionName = `evaluate_${validationPrefix}_${this.compileFunctionNamePart(funcName)}`

    return compileIifeExpression({
      awaitResult: () => this.usedAwait,
      generator: this.generator,
      isAsync: () => this.usedAwait,
      name: functionName,
      compileBody: generator => {
        const helperCall = this.compileNamedArgumentHelperCall(helperName, funcName, argExprs, source, options, scope =>
          generator.const(scope.prefix, scope.argument),
        )

        generator.return(callIsAsync ? code`await ${helperCall}` : helperCall)
      },
    })
  }

  /**
   * Assigns each argument to a named const (via `declareArgument`) before the
   * helper call, so a developer paused in the debugger can inspect the exact
   * values passed to the registered function.
   */
  private compileNamedArgumentHelperCall(
    helperName: string,
    funcName: string,
    argExprs: readonly CodeFragment[],
    source: unknown,
    options: FunctionCallCompileOptions,
    declareArgument: (scope: { prefix: string; argument: CodeFragment }) => IdentifierName,
  ): CodeFragment {
    const argumentValues = argExprs.map((argument, index) => {
      const prefix = options.argumentPrefixes?.[index] ?? `functionArgument${index + 1}`

      return declareArgument({ prefix, argument })
    })

    return this.diagnostics.wrapFunctionCall(
      helperName,
      funcName,
      argumentValues.map(argument => code`${argument}`),
      source,
    )
  }

  private compileFunctionNamePart(funcName: string): string {
    const identifier = funcName.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^([^A-Za-z_$])/, '_$1')

    if (identifier.length === 0) {
      return 'function'
    }

    return `${identifier[0].toLowerCase()}${identifier.slice(1)}`
  }

  private isStaticOperand(value: unknown): boolean {
    return isDeepStaticValue(value)
  }

  private compileStaticOperand(value: unknown, fallback: CodeFragment): CodeFragment {
    return value !== undefined ? this.compileOperandCode(value) : fallback
  }

  /**
   * Wraps a lazily-evaluated validation value (condition, message, details) in
   * a named function expression. The expression compiles inside the function
   * body with call hoisting active, so unconditional function calls emit their
   * argument consts as statements and return directly instead of nesting IIFEs.
   */
  private compileReturnFunctionExpression(compileExpression: () => CodeFragment, name: string): CodeFragment {
    return this.generator.functionExpression(
      name,
      [],
      functionGenerator => {
        const expression = this.withCallHoistingScope(functionGenerator, compileExpression)

        functionGenerator.return(expression)
      },
      { async: () => this.usedAwait },
    )
  }

  /**
   * Maps top-level reference namespaces (e.g. `data`, `session`, `params`) to
   * their corresponding runtime context property.
   */
  namespaceToCtxCode(namespace: string): CodeFragment {
    switch (namespace) {
      case 'data':
        return code`ctx.data`
      case 'session':
        return code`ctx.session`
      case 'params':
        return code`ctx.params`
      case 'query':
        return code`ctx.query`
      case 'request':
        return code`ctx.request`
      case 'post':
        return code`ctx.post`
      default:
        return code`ctx[${namespace}]`
    }
  }

  /**
   * Checks whether a value is an AST node that has been registered in the node
   * index and can be compiled into a JavaScript expression.
   */
  isCompilableNode(value: unknown): value is ASTNode {
    return isASTNode(value) && 'id' in value
  }

  /**
   * Checks whether a value is a template node (an expression node embedded
   * inside an authored value such as a block property or hook argument).
   */
  isTemplateNode(value: unknown): value is TemplateNode {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === ASTNodeType.TEMPLATE
  }
}
