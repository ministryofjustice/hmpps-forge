import { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeFamily, astNodeFamily, type ASTNodeKind } from '../../../contracts/ast/enums'
import {
  PolicyType,
  ExpressionType,
  FunctionCallType,
  IteratorType,
  PredicateType,
} from '../../../../../shared/taxonomy'
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

const COMPILABLE_NODE_KINDS: ReadonlySet<ASTNodeKind> = new Set([
  ...Object.values(ExpressionType),
  ...Object.values(PredicateType),
  FunctionCallType.CONDITION,
  FunctionCallType.TRANSFORMER,
  FunctionCallType.GENERATOR,
  PolicyType.VALIDATION_RULE,
])

export type { IteratorScopeFrame } from './types'

/**
 * Coordinates the individual expression-node compilers and owns the temporary
 * state accumulated while generating a single function.
 *
 * Concern compilers (e.g. validation, reachability, hooks) use this as the
 * single entry point for compiling AST and template expressions. Routing
 * everything through here keeps iterator scope, `@self` scope, diagnostics,
 * and generated-function await tracking consistent across generated functions.
 */
export default class ExpressionDispatcher implements NodeCompilationContext {
  private readonly iteratorFrames: IteratorScopeFrame[] = []

  private readonly selfCodeExprs: CodeFragment[] = []

  private readonly validationFunctionPrefixes: string[] = []

  /** Nested expression bodies currently being emitted, innermost last. */
  private readonly generatorScopes: CodeGenerator[] = []

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
    return this.generatorScopes[this.generatorScopes.length - 1] ?? this.fragmentGenerator
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
    this.generatorScopes.length = 0
    this.diagnostics.reset()
    this.usedAwait = false
    this.fragmentGenerator = new CodeGenerator()
  }

  /** Runs expression lowering against the function or lexical body that owns the emitted statements. */
  withGeneratorScope<T>(generator: CodeGenerator, compile: () => T): T {
    this.generatorScopes.push(generator)

    try {
      return compile()
    } finally {
      this.generatorScopes.pop()
    }
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
   * Materialised and template nodes share the same semantic kind and expression
   * compilers, so every caller uses one scope and async model.
   */
  compileExpressionCode(node: ASTNode, generator?: CodeGenerator): CodeFragment {
    if (generator !== undefined && generator !== this.generator) {
      return this.withGeneratorScope(generator, () => this.compileExpressionCode(node))
    }

    if (!this.isCompilableNode(node)) {
      return literal(node)
    }

    const properties = node.properties ?? {}
    const isPredicate = astNodeFamily(node.kind) === ASTNodeFamily.PREDICATE
    const expressionKind = isPredicate ? undefined : node.kind
    const compile = () =>
      isPredicate
        ? this.predicates.compile(node.kind, properties)
        : this.dispatchExpression(node.kind, properties, node)

    if (this.hasOwnDiagnosticBoundary(expressionKind) || this.isValidationPredicate(node.kind)) {
      return compile()
    }

    if (this.isThrowFreeReference(expressionKind)) {
      return this.diagnostics.attachPositions(compile(), node)
    }

    return this.diagnostics.compileExpression(node, this.generator, compile)
  }

  /**
   * Reference chains compile to `?.`-guarded property reads, so unless a
   * dynamic segment introduced a call they cannot throw. Tracking them through
   * a diagnostic wrapper would allocate machinery purely to attribute an
   * error that can never happen.
   */
  private isThrowFreeReference(nodeKind: string | undefined): boolean {
    return nodeKind === ExpressionType.REFERENCE
  }

  private hasOwnDiagnosticBoundary(nodeKind: string | undefined): boolean {
    // Function calls carry their own diagnostic metadata through evaluateFunction.
    // Validation rules contain tracked operands and function calls, so wrapping
    // the rule object itself only adds an unrelated callback around construction.
    return nodeKind === FunctionCallType.CONDITION ||
      nodeKind === FunctionCallType.TRANSFORMER ||
      nodeKind === FunctionCallType.GENERATOR ||
      nodeKind === PolicyType.VALIDATION_RULE
  }

  private isValidationPredicate(kind: ASTNodeKind): boolean {
    // Predicate leaves already carry diagnostics through their references and
    // registered function calls. Keep their boolean composition visible inside
    // the named validation condition instead of wrapping the whole predicate.
    return this.validationFunctionPrefixes.length > 0 && astNodeFamily(kind) === ASTNodeFamily.PREDICATE
  }

  private dispatchExpression(nodeKind: string, properties: Record<string, unknown>, source?: unknown): CodeFragment {
    switch (nodeKind) {
      case ExpressionType.REFERENCE:
        return this.references.compile(properties)
      case ExpressionType.PIPELINE:
        return this.pipelines.compilePipeline(properties)
      case ExpressionType.ITERATE:
        return this.compileIterate(properties)
      case PolicyType.VALIDATION_RULE:
        return this.compileValidation(properties)
      case FunctionCallType.CONDITION:
      case FunctionCallType.TRANSFORMER:
      case FunctionCallType.GENERATOR:
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
  compileOperandCode(value: unknown, generator?: CodeGenerator): CodeFragment {
    if (generator !== undefined && generator !== this.generator) {
      return this.withGeneratorScope(generator, () => this.compileOperandCode(value))
    }

    if (this.isCompilableNode(value)) {
      return this.compileExpressionCode(value)
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
  }

  /**
   * Builds the validation result object used by field-level and journey-level
   * validation rules.
   */
  private compileValidation(properties: Record<string, unknown>): CodeFragment {
    const functionValue = properties.function
    const condition = properties.condition

    if (functionValue === undefined && condition === undefined) {
      return literal(undefined)
    }

    const functionPrefix = this.validationFunctionPrefixes[this.validationFunctionPrefixes.length - 1] ?? 'validation'
    const ruleProperties: ObjectCodeProperty[] = []

    if (functionValue !== undefined) {
      const validationFunction = this.compileReturnFunctionExpression(
        () => this.compileOperandCode(functionValue),
        `evaluate_${functionPrefix}_function`,
      )

      ruleProperties.push({ key: 'function', value: validationFunction })
    } else {
      const messageValue = properties.message
      const detailsValue = properties.details
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

      ruleProperties.push({ key: 'condition', value: validationCondition }, { key: 'message', value: message })

      if (detailsValue !== undefined) {
        const details = this.isStaticOperand(detailsValue)
          ? this.compileStaticOperand(detailsValue, literal(undefined))
          : this.compileReturnFunctionExpression(
              () => this.compileOperandCode(detailsValue),
              `evaluate_${functionPrefix}_details`,
            )

        ruleProperties.push({ key: 'details', value: details })
      }
    }

    ruleProperties.push({ key: 'submissionOnly', value: literal(properties.submissionOnly === true) })

    if (properties.groups !== undefined) {
      ruleProperties.push({ key: 'groups', value: this.compileOperandCode(properties.groups) })
    }

    return objectCode(ruleProperties)
  }

  /**
   * Compiles a map iterator into a JavaScript expression that builds an array
   * by evaluating the yield template for each input item.
   */
  private compileMapIterator(input: unknown, yieldTemplate: unknown): CodeFragment {
    const inputExpr = this.compileOperandCode(input)
    const generator = this.generator
    const inputVar = generator.let('_input', inputExpr)
    const inputWasKeyedVar = this.compileNormalizeIteratorInput(inputVar, generator)
    const resultVar = generator.const('_result', arrayCode([]))

    this.compileIteratorArrayLoop(inputVar, generator, (indexVar, rawItemExpr) => {
      const itemVar = this.compileIteratorItemScope(rawItemExpr, inputWasKeyedVar, generator)
      const frame: IteratorScopeFrame = {
        itemVar,
        indexVar,
        inputLengthExpr: code`${inputVar}.length`,
        inputWasKeyedVar,
        rawItemExpr,
      }
      const yieldExpr = this.withIteratorFrame(frame, () =>
        yieldTemplate !== undefined ? this.compileOperandCode(yieldTemplate) : literal(undefined),
      )
      const yieldVar = generator.const('_yield', yieldExpr)

      generator.statement(code`${resultVar}.push(${yieldVar})`)
    })

    return code`${resultVar}`
  }

  /**
   * Compiles a filter iterator into a JavaScript expression that keeps only
   * items matching the predicate template.
   */
  private compileFilterIterator(input: unknown, predicateTemplate: unknown): CodeFragment {
    const inputExpr = this.compileOperandCode(input)
    const generator = this.generator
    const inputVar = generator.let('_input', inputExpr)
    const inputWasKeyedVar = this.compileNormalizeIteratorInput(inputVar, generator)
    const resultVar = generator.const('_result', arrayCode([]))

    this.compileIteratorArrayLoop(inputVar, generator, (indexVar, rawItemExpr) => {
      const itemVar = this.compileIteratorItemScope(rawItemExpr, inputWasKeyedVar, generator)
      const frame: IteratorScopeFrame = {
        itemVar,
        indexVar,
        inputLengthExpr: code`${inputVar}.length`,
        inputWasKeyedVar,
        rawItemExpr,
      }
      const predicateExpr = this.withIteratorFrame(frame, () =>
        predicateTemplate !== undefined ? this.compileOperandCode(predicateTemplate) : literal(false),
      )

      generator.if(predicateExpr, () => {
        generator.statement(code`${resultVar}.push(${rawItemExpr})`)
      })
    })

    return code`${resultVar}`
  }

  /**
   * Compiles a find iterator into a JavaScript expression that returns the
   * first item matching the predicate template.
   */
  private compileFindIterator(input: unknown, predicateTemplate: unknown): CodeFragment {
    const inputExpr = this.compileOperandCode(input)
    const generator = this.generator
    const inputVar = generator.let('_input', inputExpr)
    const inputWasKeyedVar = this.compileNormalizeIteratorInput(inputVar, generator)
    const resultVar = generator.let('_result', literal(undefined))

    this.compileIteratorArrayLoop(inputVar, generator, (indexVar, rawItemExpr) => {
      const itemVar = this.compileIteratorItemScope(rawItemExpr, inputWasKeyedVar, generator)
      const frame: IteratorScopeFrame = {
        itemVar,
        indexVar,
        inputLengthExpr: code`${inputVar}.length`,
        inputWasKeyedVar,
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

    return code`${resultVar}`
  }

  /**
   * Normalizes object inputs to `Object.entries()` tuples and records whether
   * the input was keyed before every iterator operates on the resulting array.
   * Shared with `IteratorLoopEmitter` so both iterator code paths use the same
   * entry model.
   */
  compileNormalizeIteratorInput(inputVar: IdentifierName, generator: CodeGenerator): IdentifierName {
    const inputWasKeyedVar = generator.let('iteratorInputWasKeyed', literal(false))

    generator.if(code`${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object"`, () => {
      generator.assign(inputVar, code`Object.entries(${inputVar})`)
      generator.assign(inputWasKeyedVar, literal(true))
    })

    return inputWasKeyedVar
  }

  /**
   * Produces the item value exposed to `Item()` / `Loop.Item()` references:
   * the entry value for object inputs and the element itself for array inputs.
   * Shared with `IteratorLoopEmitter` for the same reason as normalisation.
   */
  compileIteratorItemScopeExpression(
    rawItemExpr: CodeFragment | IdentifierName,
    inputWasKeyedVar: IdentifierName,
  ): CodeFragment {
    return code`${inputWasKeyedVar} ? (${rawItemExpr})[1] : ${rawItemExpr}`
  }

  private compileIteratorItemScope(
    rawItemExpr: CodeFragment,
    inputWasKeyedVar: IdentifierName,
    generator: CodeGenerator,
  ): IdentifierName {
    return generator.const('_item', this.compileIteratorItemScopeExpression(rawItemExpr, inputWasKeyedVar))
  }

  private compileIteratorArrayLoop(
    inputVar: IdentifierName,
    generator: CodeGenerator,
    compileItem: (indexVar: IdentifierName, rawItemExpr: CodeFragment) => void,
  ): void {
    generator.if(code`Array.isArray(${inputVar})`, () => {
      generator.forRange('_index', literal(0), code`${inputVar}.length`, indexVar => {
        const rawItemExpr = code`${inputVar}[${indexVar}]`

        generator.statement(code`_forgeHelpers.consumeIteratorIteration(ctx)`)

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
        functionType: (source as { kind?: string } | undefined)?.kind ?? 'unknown',
      })
    }

    this.usedAwait = true

    const validationPrefix = this.validationFunctionPrefixes[this.validationFunctionPrefixes.length - 1]

    if (validationPrefix !== undefined) {
      const helperCall = this.compileDebuggableValidationFunctionCall(funcName, argExprs, source, options)

      return this.compileMaybeAsyncResult(helperCall)
    }

    const helperCall = this.diagnostics.wrapFunctionCall('evaluateFunction', funcName, argExprs, source)

    return this.compileMaybeAsyncResult(helperCall)
  }

  private compileDebuggableValidationFunctionCall(
    funcName: string,
    argExprs: readonly CodeFragment[],
    source: unknown,
    options: FunctionCallCompileOptions,
  ): CodeFragment {
    return this.compileNamedArgumentHelperCall('evaluateFunction', funcName, argExprs, source, options, scope =>
      this.generator.const(scope.prefix, scope.argument),
    )
  }

  private compileMaybeAsyncResult(helperCall: CodeFragment): CodeFragment {
    const functionResult = this.generator.let('functionResult', helperCall)

    this.generator.if(code`_forgeHelpers.isThenable(${functionResult})`, () => {
      this.generator.assign(functionResult, code`await ${functionResult}`)
    })

    return code`${functionResult}`
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
    let bodyUsesAwait = false

    return this.generator.functionExpression(
      name,
      [],
      functionGenerator => {
        bodyUsesAwait = this.trackNestedFunctionAwait(() => {
          const expression = this.withGeneratorScope(functionGenerator, compileExpression)

          functionGenerator.return(expression)
        })
      },
      { async: () => bodyUsesAwait },
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
   * Checks whether a value is a materialised or template AST node that can be
   * compiled into a JavaScript expression.
   */
  isCompilableNode(value: unknown): value is ASTNode {
    return isASTNode(value) && COMPILABLE_NODE_KINDS.has(value.kind)
  }
}
