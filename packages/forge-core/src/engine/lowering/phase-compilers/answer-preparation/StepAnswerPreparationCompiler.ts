import { FunctionType } from '../../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { isASTNode } from '../../../contracts/ast/nodes'
import CodeEmitter from '../../emitters/CodeEmitter'
import FieldCodeEmitter from '../../emitters/FieldCodeEmitter'
import ScopedTemplateCompiler, {
  isTemplateFieldNode,
  isTemplateIterateNode,
} from '../../structures/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../../structures/RuntimeValueCompiler'
import {
  compileGeneratedFunction,
  GENERATED_FUNCTION_HELPERS_PARAM,
} from '../../function-construction/GeneratedFunctionCompiler'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import type { CompilationDependencies } from '../../compilationDependencies.type'

import type {
  CompiledFieldAnswerPreparationFunction,
  CompiledIteratorFieldAnswerPreparationFunction,
  CompiledIteratorInputFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type {
  IteratorAnswerPreparationGroup,
  IteratorFieldAnswerPreparationEntry,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { IteratorScopeFrame } from '../../expressions/ExpressionDispatcher'

/** A resolved transformer invocation read from a field's formatter chain: the registered formatter name and its authored extra arguments (the value being formatted is threaded in separately). */
interface FormatterFunctionCall {
  readonly name: string
  readonly arguments: unknown[]
}

/** Selects which answer-preparation path to emit: 'post' formats the submitted value, 'get' seeds defaults. */
type AnswerPreparationMode = 'post' | 'get'

/**
 * Compiles GET/POST answer preparation for a step or journey-root plan.
 *
 * The generated function is imperative because answer preparation is inherently
 * sequential: raw POST value, multiple handling, formatter pipeline,
 * dependentWhen, and defaultValue must update AnswerHistory in order. Formatter
 * calls receive the current value as an explicit first argument, matching the
 * author-facing formatter contract with no extra request-time wrapper state.
 *
 * Registered fields compile from FieldBlockASTNodes. MAP iterator fields compile
 * from their templates and run inline over the iterator input. A field compiles
 * to a plain Function unless one of its threaded expressions awaits, in which case
 * the whole generated function becomes an AsyncFunction.
 *
 * Generated-function construction failures throw ForgeCompilationError.
 */
export default class StepAnswerPreparationCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly values: RuntimeValueCompiler

  private readonly templates: ScopedTemplateCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.values = new RuntimeValueCompiler(this.expr, {
      expressionErrorFallback: 'undefined',
      expressionErrorMode: 'throw',
      omitUndefinedArrayItems: false,
    })
    this.templates = new ScopedTemplateCompiler(this.expr)
  }

  /**
   * Emits one registered field block in the already-selected request mode.
   */
  private compileRegisteredField(block: FieldBlockASTNode, emitter: CodeEmitter, mode: AnswerPreparationMode): void {
    emitter.comment('StepAnswerPreparationCompiler.compileRegisteredField')
    emitter.scope(() => {
      const codeExpr = this.fieldCodes.compileRegisteredExpression(block.properties.code, emitter)

      if (codeExpr === undefined) {
        return
      }

      this.compileFieldPath(block.properties, emitter, codeExpr, mode)
    })
  }

  /**
   * Emits the selected GET/POST path for a field's properties.
   */
  private compileFieldPath(
    properties: Record<string, unknown>,
    emitter: CodeEmitter,
    codeExpr: string,
    mode: AnswerPreparationMode,
  ): void {
    if (mode === 'post') {
      this.compilePostPath(properties, emitter, codeExpr)

      return
    }

    this.compileGetPath(properties, emitter, codeExpr)
  }

  /**
   * Emits POST answer preparation: read submitted value, normalize it, run formatters, then dependentWhen.
   */
  private compilePostPath(properties: Record<string, unknown>, emitter: CodeEmitter, codeExpr: string): void {
    emitter.comment('StepAnswerPreparationCompiler.compilePostPath')
    const historyVar = emitter.const(
      'answerHistory',
      `${GENERATED_FUNCTION_HELPERS_PARAM}.ensureAnswerHistory(ctx, ${codeExpr})`,
    )
    const rawVar = emitter.let(
      'rawValue',
      `${GENERATED_FUNCTION_HELPERS_PARAM}.normalizePostValue(ctx.post[${codeExpr}], ${String(properties.multiple === true)})`,
    )

    this.emitPushMutationCall(emitter, historyVar, rawVar, 'post')

    const formatters = properties.formatters

    if (Array.isArray(formatters) && formatters.length > 0) {
      const formattedVar = emitter.let('formattedValue', rawVar)

      this.compileFormatterPipeline(formatters, emitter, formattedVar)

      emitter.if(`${formattedVar} !== ${rawVar}`, () => {
        this.emitPushMutationCall(emitter, historyVar, formattedVar, 'processed')
      })
    }

    this.compileDependentWhen(properties.dependentWhen, emitter, codeExpr, historyVar)
  }

  /**
   * Emits GET answer preparation: seed defaultValue only when no current answer exists.
   */
  private compileGetPath(properties: Record<string, unknown>, emitter: CodeEmitter, codeExpr: string): void {
    emitter.comment('StepAnswerPreparationCompiler.compileGetPath')
    const historyVar = emitter.let('answerHistory', `ctx.answers[${codeExpr}]`)

    emitter.if(`!(${historyVar} && ${historyVar}.current !== undefined)`, () => {
      emitter.assign(historyVar, `${GENERATED_FUNCTION_HELPERS_PARAM}.ensureAnswerHistory(ctx, ${codeExpr})`)
      this.compileDefaultValue(properties.defaultValue, emitter, historyVar)
    })
  }

  /**
   * Emits sequential formatter execution, stopping after recoverable type coercion failures.
   */
  private compileFormatterPipeline(formatters: unknown[], emitter: CodeEmitter, valueVar: string): void {
    const compilableFormatters = formatters.filter(
      formatter => isASTNode(formatter) || this.expr.isTemplateNode(formatter),
    )

    if (compilableFormatters.length === 0) {
      return
    }

    emitter.comment('StepAnswerPreparationCompiler.compileFormatterPipeline')
    const originalValueVar = emitter.const('originalFormatterValue', valueVar)
    const failedVar = emitter.let('formatterFailed', 'false')

    for (const formatter of compilableFormatters) {
      const callExpr = this.compileFormatterCall(formatter, valueVar)

      emitter.if(`!${failedVar}`, () => {
        const resultVar = emitter.let('formatterResult')

        emitter.tryCatch(
          () => emitter.assign(resultVar, callExpr),
          'formatterError',
          errorVar => {
            emitter.if(
              `${errorVar} instanceof TypeError || (${errorVar} && ${errorVar}.cause instanceof TypeError)`,
              () => {
                emitter.assign(valueVar, originalValueVar)
                emitter.assign(failedVar, 'true')
              },
              () => emitter.code(`throw ${errorVar};`),
            )
          },
        )
        emitter.if(`!${failedVar} && ${resultVar} !== undefined`, () => emitter.assign(valueVar, resultVar))
      })
    }
  }

  /**
   * Emits the dependentWhen guard at the tail of the POST path: when the authored
   * condition evaluates falsy, push an undefined mutation to clear the answer. A
   * missing or non-expression dependentWhen emits nothing.
   */
  private compileDependentWhen(
    dependentWhen: unknown,
    emitter: CodeEmitter,
    codeExpr: string,
    historyVar: string,
  ): void {
    if (!dependentWhen) {
      return
    }

    if (!isASTNode(dependentWhen) && !this.expr.isTemplateNode(dependentWhen)) {
      return
    }

    emitter.comment('StepAnswerPreparationCompiler.compileDependentWhen')
    const dependentWhenVar = emitter.let('dependentWhenResult')

    this.values.compileValue(dependentWhen, emitter, dependentWhenVar, {
      expressionErrorFallback: 'true',
    })
    emitter.if(`!${dependentWhenVar}`, () => {
      this.emitPushMutationCall(emitter, historyVar, 'undefined', 'dependentWhen')
    })
  }

  /**
   * Emits defaultValue resolution for GET requests with no existing answer.
   */
  private compileDefaultValue(defaultValue: unknown, emitter: CodeEmitter, historyVar: string): void {
    emitter.comment('StepAnswerPreparationCompiler.compileDefaultValue')

    if (defaultValue !== undefined) {
      const defaultValueVar = emitter.let('defaultValue')

      this.values.compileValue(defaultValue, emitter, defaultValueVar)
      this.emitPushMutationCall(emitter, historyVar, defaultValueVar, 'default')

      return
    }

    this.emitPushMutationCall(emitter, historyVar, 'undefined', 'default')
  }

  /**
   * Emits one field block produced inside an iterator template in the selected request mode.
   */
  private compileTemplateField(
    field: TemplateNode,
    codeExpr: string | undefined,
    emitter: CodeEmitter,
    mode: AnswerPreparationMode,
  ): void {
    const resolvedCodeExpr = codeExpr ?? 'undefined'
    const properties = field.properties ?? {}

    emitter.comment('StepAnswerPreparationCompiler.compileTemplateField')
    emitter.scope(() => {
      this.compileFieldPath(properties, emitter, resolvedCodeExpr, mode)
    })
  }

  /**
   * Compiles one transformer from a field's formatter array.
   *
   * The formatter array is already the chain: each transformer receives the
   * current answer value as its first argument, then the compiler threads the
   * result into the next formatter.
   */
  private compileFormatterCall(formatterNode: unknown, valueVar: string): string {
    const formatterCall = readFormatterTransformerCall(formatterNode)

    if (formatterCall !== undefined) {
      return this.compileFormatterFunctionCall(formatterCall, valueVar, formatterNode)
    }

    return this.expr.compileFunctionCall('unknown', [valueVar])
  }

  /**
   * Emits the authored transformer call with the current formatted value as its first argument.
   */
  private compileFormatterFunctionCall(
    formatterCall: FormatterFunctionCall,
    valueVar: string,
    source: unknown,
  ): string {
    const argExprs = formatterCall.arguments.map(arg => this.expr.compileOperand(arg))

    return this.expr.compileFunctionCall(formatterCall.name, [valueVar, ...argExprs], source)
  }

  /**
   * Emits the mutation/current update pair that keeps AnswerHistory in sync.
   */
  private emitPushMutationCall(emitter: CodeEmitter, historyVar: string, valueExpr: string, source: string): void {
    emitter.code(
      `${GENERATED_FUNCTION_HELPERS_PARAM}.pushAnswerMutation(${historyVar}, ${valueExpr}, ${JSON.stringify(source)});`,
    )
  }

  /**
   * Compiles one registered field into a standalone prepare function that branches on request method
   * at call time, formatting the submitted value on POST or seeding the default on GET. The compiled
   * function mutates ctx.answers in place and is async only if any threaded expression awaits.
   */
  compileSingleFieldPreparation(block: FieldBlockASTNode): CompiledFieldAnswerPreparationFunction {
    return compileGeneratedFunction<CompiledFieldAnswerPreparationFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSingleFieldPreparationSource(block),
      { phase: 'answer-preparation' },
    )
  }

  /** Emits the source for a registered field's prepare function: a runtime branch on request method into the POST or GET path. */
  private buildSingleFieldPreparationSource(block: FieldBlockASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepAnswerPreparationCompiler.buildSingleFieldPreparationSource')
    emitter.declareConst('isPost', 'ctx.request.method === "POST"')

    emitter.if(
      'isPost',
      () => this.compileRegisteredField(block, emitter, 'post'),
      () => this.compileRegisteredField(block, emitter, 'get'),
    )

    return emitter.toString()
  }

  /**
   * Compiles a MAP iterator into an answer-preparation group: an evaluateInput function that expands the
   * collection into per-item scopes plus one prepare function per leaf field, gathered through any nesting.
   * Returns undefined when the iterator yields no fields, so empty iterators emit no group.
   */
  compileIteratorGroup(iterateNode: IterateASTNode): IteratorAnswerPreparationGroup | undefined {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return undefined
    }

    const fields: IteratorFieldAnswerPreparationEntry[] = []

    this.collectLeafFields(template, fields, [])

    if (fields.length === 0) {
      return undefined
    }

    const evaluateInput = this.compileIteratorInputEvaluator(iterateNode)

    return { evaluateInput, fields }
  }

  /**
   * Walks a yield template one level at a time, appending a prepare entry for each direct field and
   * recursing into each nested MAP iterator with that iterator pushed onto ancestorIterates. The
   * accumulated ancestor chain lets each leaf field reconstruct the inline loops for its enclosing levels.
   */
  private collectLeafFields(
    template: TemplateValue,
    entries: IteratorFieldAnswerPreparationEntry[],
    ancestorIterates: readonly TemplateNode[],
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node => isTemplateFieldNode(node) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateFieldNode(node)) {
        entries.push({
          prepare: this.compileIteratorFieldPreparation(node, ancestorIterates),
        })

        return
      }

      const yieldTemplate = this.templates.getMapIterateYieldTemplate(node)

      if (yieldTemplate !== undefined) {
        this.collectLeafFields(yieldTemplate, entries, [...ancestorIterates, node])
      }
    })
  }

  /** Compiles the iterator's input expression into a function that yields the per-item scopes the group's prepare functions run over. */
  private compileIteratorInputEvaluator(iterateNode: IterateASTNode): CompiledIteratorInputFunction {
    return compileGeneratedFunction<CompiledIteratorInputFunction>(
      this.expr,
      ['ctx'],
      () => this.buildIteratorInputEvaluatorSource(iterateNode),
      { phase: 'iterator-input' },
    )
  }

  /**
   * Emits the input evaluator source: normalize the input (an object becomes an array of per-entry
   * items), then if the normalized value is an array build one scope { item, index, rawItem, inputLength }
   * per element, skipping null/undefined entries. Returns an empty array for any input that does not
   * normalize to an array.
   */
  private buildIteratorInputEvaluatorSource(iterateNode: IterateASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepAnswerPreparationCompiler.buildIteratorInputEvaluatorSource')

    const inputVar = emitter.let('iteratorInput', this.expr.compileOperand(iterateNode.properties.input))

    this.templates.compileNormalizeIteratorInput(inputVar, emitter)

    emitter.declareConst('result', '[]')
    emitter.if(`Array.isArray(${inputVar})`, () => {
      const indexVar = emitter.let('i', '0')

      emitter.while(`${indexVar} < ${inputVar}.length`, () => {
        const rawItemVar = emitter.const('rawItem', `${inputVar}[${indexVar}]`)

        emitter.assign(indexVar, `${indexVar} + 1`)
        emitter.if(`${rawItemVar} == null`, () => emitter.continue())

        const itemVar = emitter.const('item', this.templates.compileIteratorItemScope(rawItemVar))

        emitter.code(
          `result.push({ item: ${itemVar}, index: ${indexVar} - 1, rawItem: ${rawItemVar}, inputLength: ${inputVar}.length });`,
        )
      })
    })
    emitter.emitBlank()
    emitter.return('result')

    return emitter.toString()
  }

  /**
   * Compiles one iterator leaf field into a prepare function taking the outer item scope, mutating
   * ctx.answers in place once per item. ancestorIterates are the intermediate MAP levels between the
   * group root and this field, emitted as inline loops so deeper @scope/@loop references resolve.
   */
  private compileIteratorFieldPreparation(
    field: TemplateNode,
    ancestorIterates: readonly TemplateNode[],
  ): CompiledIteratorFieldAnswerPreparationFunction {
    return compileGeneratedFunction<CompiledIteratorFieldAnswerPreparationFunction>(
      this.expr,
      ['ctx', 'iteratorScope'],
      () => this.buildIteratorFieldPreparationSource(field, ancestorIterates),
      { phase: 'answer-preparation' },
    )
  }

  /**
   * Emits an iterator leaf field's prepare source: binds the outer iterator frame to the passed-in
   * iteratorScope, then descends through any intermediate iterator levels before compiling the field.
   */
  private buildIteratorFieldPreparationSource(field: TemplateNode, ancestorIterates: readonly TemplateNode[]): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepAnswerPreparationCompiler.buildIteratorFieldPreparationSource')
    emitter.declareConst('isPost', 'ctx.request.method === "POST"')

    const outerFrame: IteratorScopeFrame = {
      itemVar: 'iteratorScope.item',
      indexVar: 'iteratorScope.index',
      inputLengthExpr: 'iteratorScope.inputLength',
      rawItemExpr: 'iteratorScope.rawItem',
    }

    this.expr.withIteratorFrame(outerFrame, () => {
      this.emitNestedLoopsAndCompileField(field, ancestorIterates, 0, emitter)
    })

    return emitter.toString()
  }

  /**
   * Recursively emits an inline MAP loop for each ancestor iterator above the given depth, pushing its
   * frame, then at the innermost level compiles the field's code expression and branches on request method
   * into the POST or GET path.
   */
  private emitNestedLoopsAndCompileField(
    field: TemplateNode,
    ancestorIterates: readonly TemplateNode[],
    depth: number,
    emitter: CodeEmitter,
  ): void {
    if (depth >= ancestorIterates.length) {
      const codeExpr = this.templates.compileTemplateCodeExpression(field, emitter)

      emitter.if(
        'isPost',
        () => this.compileTemplateField(field, codeExpr, emitter, 'post'),
        () => this.compileTemplateField(field, codeExpr, emitter, 'get'),
      )

      return
    }

    this.templates.compileTemplateMapIterator(ancestorIterates[depth], emitter, () => {
      this.emitNestedLoopsAndCompileField(field, ancestorIterates, depth + 1, emitter)
    })
  }

  /**
   * Fast pre-check used to avoid emitting iterator loops for templates with no fields.
   */
  private containsTemplateField(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(template, isTemplateFieldNode)
  }
}

/** Reads a formatter node into a FormatterFunctionCall, or undefined when it is not a named transformer. */
function readFormatterTransformerCall(value: unknown): FormatterFunctionCall | undefined {
  if (readExpressionType(value) !== FunctionType.TRANSFORMER) {
    return undefined
  }

  const properties = readProperties(value) ?? (isRecord(value) ? value : undefined)

  if (properties === undefined || typeof properties.name !== 'string') {
    return undefined
  }

  const args = Array.isArray(properties.arguments) ? properties.arguments : []

  return {
    name: properties.name,
    arguments: args,
  }
}

/** Reads a node's discriminator, tolerating both expressionType and type field names. */
function readExpressionType(value: unknown): unknown {
  if (!isRecord(value)) {
    return undefined
  }

  return value.expressionType ?? value.type
}

/** Returns a node's nested properties record, or undefined when absent or not an object. */
function readProperties(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value.properties)) {
    return undefined
  }

  return value.properties
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}
