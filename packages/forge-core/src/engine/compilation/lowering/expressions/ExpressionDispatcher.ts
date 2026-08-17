import { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, FunctionType, IteratorType } from '../../../../authoring/types/enums'
import { TemplateNode } from '../../../contracts/ast/template.type'
import ForgeUnregisteredFunctionError from '../../../errors/ForgeUnregisteredFunctionError'
import { Code, arrayCode, code, literal, objectCode, SafeCode } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'
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
import CompilationTracer from '../../tracing/CompilationTracer'
import { compileIifeExpression } from './IifeExpressionCompiler'

export type { IteratorScopeFrame } from './types'

/**
 * Coordinates expression-node compilers and owns transient code-generation state.
 *
 * Phase compilers use this as the single entry point for compiling AST and
 * template expressions so iterator scope, @self scope, diagnostics, and async
 * function-call discovery stay consistent across generated functions.
 */
export default class ExpressionDispatcher implements NodeCompilationContext {
  private readonly iteratorFrames: IteratorScopeFrame[] = []

  private readonly selfCodeExprs: Code[] = []

  private readonly validationFunctionPrefixes: string[] = []

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

  get selfCodeExpr(): Code | undefined {
    return this.selfCodeExprs[this.selfCodeExprs.length - 1]
  }

  get usesAwait(): boolean {
    return this.usedAwait
  }

  get generator(): CodeGenerator {
    return this.fragmentGenerator
  }

  get tracer(): CompilationTracer {
    return this.dependencies.tracer ?? CompilationTracer.disabled
  }

  get diagnosticCatalogue(): readonly DiagnosticMetadata[] {
    return this.diagnostics.snapshot()
  }

  /**
   * Clears per-function generation state before a phase compiler builds source.
   */
  reset(): void {
    this.iteratorFrames.length = 0
    this.selfCodeExprs.length = 0
    this.validationFunctionPrefixes.length = 0
    this.diagnostics.reset()
    this.usedAwait = false
    this.fragmentGenerator = new CodeGenerator()
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
  pushSelfCodeExpression(codeExpr: Code): void {
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

    const typedCodeExpression = codeExpr instanceof Name ? code`${codeExpr}` : codeExpr

    this.pushSelfCodeExpression(typedCodeExpression)

    try {
      return compile()
    } finally {
      this.popSelfCodeExpression()
    }
  }

  /**
   * Gives validation callbacks a stable developer-facing identity while their
   * authored value is lowered through the shared runtime-value compiler.
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
   * Registered AST nodes and iterator template nodes share the same expression
   * compilers. Keeping the dispatch split here lets render, validation, answer
   * prep, reachability, and hooks all use one scope and async model.
   */
  compileExpressionCode(node: ASTNode): Code {
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

    return this.diagnostics.wrapExpression(expression, node, this.usedAwait, this.generator)
  }

  /**
   * Compiles template-embedded expression nodes using the same scope model as registered AST nodes.
   */
  compileTemplateExpressionCode(node: TemplateNode): Code {
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

    return this.diagnostics.wrapExpression(expression, node, this.usedAwait, this.generator)
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

  private dispatchExpression(expressionType: string, properties: Record<string, unknown>, source?: unknown): Code {
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
  compileOperandCode(value: unknown): Code {
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
   * Dispatches authored iterators to expression-level MAP, FILTER, and FIND emitters.
   */
  private compileIterate(properties: Record<string, unknown>): Code {
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

    return literal(undefined)
  }

  /**
   * Builds the validation result object used by field and domain validation slots.
   */
  private compileValidation(properties: Record<string, unknown>): Code {
    const condition = properties.condition

    if (condition === undefined) {
      return literal(undefined)
    }

    const conditionExpr = this.compileOperandCode(condition)
    const messageValue = properties.message
    const messageExpr = messageValue !== undefined ? this.compileOperandCode(messageValue) : literal('')
    const submissionOnlyExpr = literal(properties.submissionOnly === true)
    const groupsExpr = properties.groups !== undefined ? this.compileOperandCode(properties.groups) : literal(undefined)
    const detailsValue = properties.details
    const detailsExpr = detailsValue !== undefined ? this.compileOperandCode(detailsValue) : literal(undefined)
    const functionPrefix = this.validationFunctionPrefixes[this.validationFunctionPrefixes.length - 1] ?? 'validation'
    const validationCondition = this.compileReturnFunctionExpression(
      conditionExpr,
      `evaluate_${functionPrefix}_condition`,
      'conditionResult',
      'Evaluate the authored condition for this validation rule.',
    )
    const message = this.isStaticOperand(messageValue)
      ? messageExpr
      : this.compileReturnFunctionExpression(
          messageExpr,
          `evaluate_${functionPrefix}_message`,
          'validationMessage',
          'Resolve the message returned when this validation rule fails.',
        )
    const details = this.isStaticOperand(detailsValue)
      ? detailsExpr
      : this.compileReturnFunctionExpression(
          detailsExpr,
          `evaluate_${functionPrefix}_details`,
          'validationDetails',
          'Resolve the structured details returned with this validation failure.',
        )

    return objectCode([
      { key: 'condition', value: validationCondition },
      { key: 'message', value: message },
      { key: 'submissionOnly', value: submissionOnlyExpr },
      { key: 'groups', value: groupsExpr },
      { key: 'details', value: details },
    ])
  }

  /**
   * Emits expression-level map iteration when a template value needs a returned array.
   */
  private compileMapIterator(input: unknown, yieldTemplate: unknown): Code {
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
   * Emits expression-level filter iteration while preserving iterator scope references.
   */
  private compileFilterIterator(input: unknown, predicateTemplate: unknown): Code {
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
   * Emits expression-level find iteration with the first matching item as the result.
   */
  private compileFindIterator(input: unknown, predicateTemplate: unknown): Code {
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
   * Normalizes object inputs to keyed items so iterator templates can use @key and @value.
   */
  private compileNormalizeIteratorInput(inputVar: Name, generator: CodeGenerator): void {
    generator.if(code`${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object"`, () => {
      const mapEntry = generator.functionExpression(
        'normalise_iterator_entry',
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
      const keepItem = generator.functionExpression('keep_iterator_item', ['item'], (callbackGenerator, [item]) => {
        callbackGenerator.return(code`${item} != null`)
      })

      generator.assign(inputVar, code`${inputVar}.filter(${keepItem})`)
    })
  }

  /**
   * Creates the per-item object exposed to @scope references inside iterator templates.
   */
  private compileIteratorItemScope(rawItemExpr: Code, generator: CodeGenerator): Name {
    return generator.const(
      '_item',
      code`typeof ${rawItemExpr} === "object" && ${rawItemExpr} !== null ? Object.assign({}, ${rawItemExpr}) : ${objectCode([{ key: '@value', value: rawItemExpr }])}`,
    )
  }

  /**
   * Isolates iterator expressions so local item and index variables cannot leak outward.
   */
  private compileScopedIteratorExpression(expr: Code, itemVar: Name, indexVar: Name, generator: CodeGenerator): Code {
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
    inputVar: Name,
    generator: CodeGenerator,
    compileItem: (indexVar: Name, rawItemExpr: Code) => void,
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
    argExprs: readonly Code[],
    source?: unknown,
    options: FunctionCallCompileOptions = {},
  ): Code {
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
    argExprs: readonly Code[],
    source: unknown,
    validationPrefix: string,
    options: FunctionCallCompileOptions,
    callIsAsync: boolean,
  ): Code {
    const functionName = `evaluate_${validationPrefix}_${this.compileFunctionNamePart(funcName)}`

    return compileIifeExpression({
      awaitResult: () => this.usedAwait,
      generator: this.generator,
      isAsync: () => this.usedAwait,
      name: functionName,
      compileBody: generator => {
        if (argExprs.length > 0) {
          generator.note(`Resolve the arguments passed to ${funcName}.`)
        }

        const argumentValues = argExprs.map((argument, index) => {
          const prefix = options.argumentPrefixes?.[index] ?? `functionArgument${index + 1}`

          return generator.const(prefix, argument)
        })

        generator.note(`Call the registered ${funcName} function.`)
        const helperCall = this.diagnostics.wrapFunctionCall(
          helperName,
          funcName,
          argumentValues.map(argument => code`${argument}`),
          source,
        )
        const functionResult = generator.const('functionResult', callIsAsync ? code`await ${helperCall}` : helperCall)

        generator.return(functionResult)
      },
    })
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

  private compileReturnFunctionExpression(
    expression: Code,
    name: string,
    resultPrefix: string,
    explanation: string,
  ): Code {
    return this.generator.functionExpression(
      name,
      [],
      functionGenerator => {
        functionGenerator.note(explanation)
        const result = functionGenerator.const(resultPrefix, this.usedAwait ? code`await ${expression}` : expression)

        functionGenerator.return(result)
      },
      { async: () => this.usedAwait },
    )
  }

  /**
   * Maps top-level DSL reference namespaces to their runtime context objects.
   */
  namespaceToCtxCode(namespace: string): Code {
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
