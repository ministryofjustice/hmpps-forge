import NullishNodeCompiler from './NullishNodeCompiler'
import {
  AuthoredValueKind,
  type AuthoredValue,
  type BlockValue,
  type ExpressionValue,
  type ValidationValue,
} from '../../../contracts/models/authoredValue.type'
import ForgeInternalError from '../../../../errors/ForgeInternalError'
import ForgeUnregisteredFunctionError from '../../../../errors/ForgeUnregisteredFunctionError'
import {
  CodeFragment,
  arrayCode,
  code,
  literal,
  objectCode,
  structuredLiteralCode,
  type ObjectCodeProperty,
  type SafeCode,
} from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'
import DiagnosticEmitter, { type DiagnosticMetadata } from '../emitters/DiagnosticEmitter'
import { type FunctionCallCompileOptions, type IteratorScopeFrame, type NodeCompilationContext } from './types'
import ReferenceNodeCompiler from './ReferenceNodeCompiler'
import PredicateNodeCompiler from './PredicateNodeCompiler'
import PipelineNodeCompiler from './PipelineNodeCompiler'
import ConditionalNodeCompiler from './ConditionalNodeCompiler'
import MatchNodeCompiler from './MatchNodeCompiler'
import IteratorNodeCompiler from './IteratorNodeCompiler'
import type { CompilationDependencies } from '../compilationDependencies.type'

/** Owns value compilation, lexical scope, diagnostics and async tracking for one generated function. */
export default class ExpressionDispatcher implements NodeCompilationContext {
  private readonly iteratorFrames: IteratorScopeFrame[] = []

  private readonly selfCodeExprs: CodeFragment[] = []

  private readonly validationFunctionPrefixes: string[] = []

  /** Nested expression bodies currently being emitted, innermost last. */
  private readonly generatorScopes: CodeGenerator[] = []

  private readonly references = new ReferenceNodeCompiler(this)

  private readonly predicates = new PredicateNodeCompiler(this)

  private readonly pipelines = new PipelineNodeCompiler(this)

  private readonly nullish = new NullishNodeCompiler(this)

  private readonly conditionals = new ConditionalNodeCompiler(this)

  private readonly matches = new MatchNodeCompiler(this)

  private readonly iterators = new IteratorNodeCompiler(this)

  private readonly diagnostics = new DiagnosticEmitter()

  private usedAwait = false

  private fragmentGenerator = new CodeGenerator()

  constructor(
    private readonly dependencies: CompilationDependencies,
    private readonly compileBlockValue?: (block: BlockValue, generator: CodeGenerator, nameHint: string) => SafeCode,
  ) {}

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
   * analysed value is compiled through the shared value compiler.
   */
  withValidationFunctionPrefix<T>(prefix: string, compile: () => T): T {
    this.validationFunctionPrefixes.push(prefix)

    try {
      return compile()
    } finally {
      this.validationFunctionPrefixes.pop()
    }
  }

  /** Every operand is analysed before lowering; recursion always returns here. */
  compileValueCode(value: AuthoredValue, generator?: CodeGenerator): CodeFragment {
    if (generator !== undefined && generator !== this.generator) {
      return this.withGeneratorScope(generator, () => this.compileValueCode(value))
    }

    switch (value.kind) {
      case AuthoredValueKind.STATIC:
        return structuredLiteralCode(value.value)
      case AuthoredValueKind.RECORD:
        return objectCode(
          value.entries.map(entry => ({ key: entry.key, value: this.compileContainerValue(entry.value, entry.key) })),
        )
      case AuthoredValueKind.LIST:
        return arrayCode(value.items.map(item => this.compileContainerValue(item, 'arrayItem')))
      case AuthoredValueKind.BLOCK:
        return this.compileBlockExpression(value, 'nestedBlock')
      default:
        return this.compileExpressionValue(value)
    }
  }

  /** Compiles a match predicate against its already evaluated subject. */
  compileMatchPredicateCode(value: AuthoredValue, subject: CodeFragment): CodeFragment {
    return this.predicates.compileOperand(value, subject)
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
        functionType:
          source !== null && typeof source === 'object' && 'kind' in source ? String(source.kind) : 'unknown',
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

  private compileContainerValue(value: AuthoredValue, nameHint: string): CodeFragment {
    if (value.kind === AuthoredValueKind.BLOCK) {
      return this.compileBlockExpression(value, nameHint)
    }

    const result = this.compileValueCode(value)

    if (value.kind === AuthoredValueKind.STATIC) {
      return result
    }

    // Capture each value before compiling the next sibling, which may invoke user code.
    const prefix = nameHint.replace(/[^A-Za-z0-9_$]/g, '') || 'property'

    return code`${this.generator.const(`${/^[A-Za-z_$]/.test(prefix) ? prefix : 'property'}Value`, result)}`
  }

  private compileBlockExpression(value: BlockValue, nameHint: string): CodeFragment {
    if (this.compileBlockValue === undefined) {
      throw new ForgeInternalError('A nested block value is only compilable by the resolve concern')
    }

    return code`${this.compileBlockValue(value, this.generator, nameHint)}`
  }

  private compileExpressionValue(value: ExpressionValue): CodeFragment {
    const compile = () => this.dispatchExpression(value)

    if (
      value.kind === AuthoredValueKind.FUNCTION ||
      value.kind === AuthoredValueKind.VALIDATION ||
      (value.kind === AuthoredValueKind.PREDICATE && this.validationFunctionPrefixes.length > 0)
    ) {
      return compile()
    }

    if (value.kind === AuthoredValueKind.REFERENCE) {
      const reference = this.diagnostics.attachPositions(compile(), value.source)

      // Later operands can invoke user code that changes the referenced object.
      return code`${this.generator.const('referenceValue', reference)}`
    }

    return this.diagnostics.compileExpression(value.source, this.generator, compile)
  }

  private dispatchExpression(value: ExpressionValue): CodeFragment {
    switch (value.kind) {
      case AuthoredValueKind.REFERENCE:
        return this.references.compile(value)
      case AuthoredValueKind.PIPELINE:
        return this.pipelines.compilePipeline(value)
      case AuthoredValueKind.ITERATION:
        return this.iterators.compile(value)
      case AuthoredValueKind.VALIDATION:
        return this.compileValidation(value)
      case AuthoredValueKind.FUNCTION:
        return this.pipelines.compileFunction(value)
      case AuthoredValueKind.PREDICATE:
        return this.predicates.compile(value)
      case AuthoredValueKind.NULLISH:
        return this.nullish.compile(value)
      case AuthoredValueKind.CONDITIONAL:
        return this.conditionals.compile(value)
      case AuthoredValueKind.MATCH:
        return this.matches.compile(value)
      default: {
        const unsupported: never = value

        throw new ForgeInternalError(`Unsupported expression value: ${unsupported}`)
      }
    }
  }

  /**
   * Builds the validation result object used by field-level and journey-level
   * validation rules.
   */
  private compileValidation(properties: ValidationValue): CodeFragment {
    const functionValue = properties.function
    const condition = properties.condition

    if (functionValue === undefined && condition === undefined) {
      return literal(undefined)
    }

    const functionPrefix = this.validationFunctionPrefixes[this.validationFunctionPrefixes.length - 1] ?? 'validation'
    const ruleProperties: ObjectCodeProperty[] = []

    if (functionValue !== undefined) {
      const validationFunction = this.compileReturnFunctionExpression(
        () => this.compileValueCode(functionValue),
        `evaluate_${functionPrefix}_function`,
      )

      ruleProperties.push({ key: 'function', value: validationFunction })
    } else {
      const messageValue = properties.message
      const detailsValue = properties.details
      const validationCondition = this.compileReturnFunctionExpression(
        () => (condition === undefined ? literal(false) : this.compileValueCode(condition)),
        `evaluate_${functionPrefix}_condition`,
      )
      const message =
        messageValue.kind === AuthoredValueKind.STATIC
          ? this.compileStaticOperand(messageValue, literal(''))
          : this.compileReturnFunctionExpression(
              () => this.compileValueCode(messageValue),
              `evaluate_${functionPrefix}_message`,
            )

      ruleProperties.push({ key: 'condition', value: validationCondition }, { key: 'message', value: message })

      if (detailsValue !== undefined) {
        const details =
          detailsValue.kind === AuthoredValueKind.STATIC
            ? this.compileStaticOperand(detailsValue, literal(undefined))
            : this.compileReturnFunctionExpression(
                () => this.compileValueCode(detailsValue),
                `evaluate_${functionPrefix}_details`,
              )

        ruleProperties.push({ key: 'details', value: details })
      }
    }

    ruleProperties.push({ key: 'submissionOnly', value: literal(properties.submissionOnly === true) })

    if (properties.groups !== undefined) {
      ruleProperties.push({ key: 'groups', value: this.compileValueCode(properties.groups) })
    }

    return objectCode(ruleProperties)
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

  private compileStaticOperand(value: AuthoredValue, fallback: CodeFragment): CodeFragment {
    return value.kind === AuthoredValueKind.STATIC && value.value === undefined
      ? fallback
      : this.compileValueCode(value)
  }

  /**
   * Wraps a lazily-evaluated validation value (condition, message, details) in
   * a named function expression. The expression compiles inside the function
   * body’s own generator scope, preserving lazy evaluation and async tracking.
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

}
