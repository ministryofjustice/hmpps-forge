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

import type { TemplateNodeId } from '../../../contracts/ast/ast.type'
import type {
  CompiledFieldAnswerPreparationFunction,
  CompiledMaterialisedFieldAnswerPreparationFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type { CompiledFieldAnswerPreparation } from '../../../contracts/plans/compilationArtefacts.type'
import type { IteratorScopeFrame } from '../../expressions/ExpressionDispatcher'

/** A resolved transformer invocation read from a field's transformer chain: the registered transformer name and its authored extra arguments (the value is threaded in separately). */
interface TransformerFunctionCall {
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
   * Emits GET answer preparation: seed defaultValue only when no current answer exists, then parse the stored value for display.
   */
  private compileGetPath(properties: Record<string, unknown>, emitter: CodeEmitter, codeExpr: string): void {
    emitter.comment('StepAnswerPreparationCompiler.compileGetPath')
    const historyVar = emitter.let('answerHistory', `ctx.answers[${codeExpr}]`)

    emitter.if(`!(${historyVar} && ${historyVar}.current !== undefined)`, () => {
      emitter.assign(historyVar, `${GENERATED_FUNCTION_HELPERS_PARAM}.ensureAnswerHistory(ctx, ${codeExpr})`)
      this.compileDefaultValue(properties.defaultValue, emitter, historyVar)
    })

    const parsers = properties.parsers

    if (Array.isArray(parsers) && parsers.length > 0) {
      emitter.if(`${historyVar} && ${historyVar}.current !== undefined`, () => {
        const parsedVar = emitter.let('parsedValue', `${historyVar}.current`)

        this.compileTransformerPipeline(parsers, emitter, parsedVar)

        emitter.if(`${parsedVar} !== undefined`, () => {
          emitter.assign(`${historyVar}.parsed`, parsedVar)
        })
      })
    }
  }

  /**
   * Emits sequential transformer execution, stopping after recoverable type coercion failures.
   */
  private compileFormatterPipeline(formatters: unknown[], emitter: CodeEmitter, valueVar: string): void {
    this.compileTransformerPipeline(formatters, emitter, valueVar)
  }

  /**
   * Emits sequential transformer execution, stopping after recoverable type coercion failures.
   */
  private compileTransformerPipeline(transformers: unknown[], emitter: CodeEmitter, valueVar: string): void {
    const compilableTransformers = transformers.filter(
      transformer => isASTNode(transformer) || this.expr.isTemplateNode(transformer),
    )

    if (compilableTransformers.length === 0) {
      return
    }

    emitter.comment('StepAnswerPreparationCompiler.compileTransformerPipeline')
    const originalValueVar = emitter.const('originalTransformerValue', valueVar)
    const failedVar = emitter.let('transformerFailed', 'false')

    for (const transformer of compilableTransformers) {
      const callExpr = this.compileTransformerCall(transformer, valueVar)

      emitter.if(`!${failedVar}`, () => {
        const resultVar = emitter.let('transformerResult')

        emitter.tryCatch(
          () => emitter.assign(resultVar, callExpr),
          'transformerError',
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
   * Compiles one transformer from a field's formatter or parser array.
   *
   * The transformer array is already the chain: each transformer receives the
   * current answer value as its first argument, then the compiler threads the
   * result into the next transformer.
   */
  private compileTransformerCall(transformerNode: unknown, valueVar: string): string {
    const transformerCall = readTransformerCall(transformerNode)

    if (transformerCall !== undefined) {
      return this.compileTransformerFunctionCall(transformerCall, valueVar, transformerNode)
    }

    return this.expr.compileFunctionCall('unknown', [valueVar])
  }

  /**
   * Emits the authored transformer call with the current value as its first argument.
   */
  private compileTransformerFunctionCall(
    transformerCall: TransformerFunctionCall,
    valueVar: string,
    source: unknown,
  ): string {
    const argExprs = transformerCall.arguments.map(arg => this.expr.compileOperand(arg))

    return this.expr.compileFunctionCall(transformerCall.name, [valueVar, ...argExprs], source)
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
   * Compiles one registered field into an identified prepare entry whose function branches on
   * request method at call time, formatting the submitted value on POST or seeding the default on
   * GET. The compiled function mutates ctx.answers in place and is async only if any threaded
   * expression awaits.
   */
  compileFieldPreparation(block: FieldBlockASTNode): CompiledFieldAnswerPreparation {
    return {
      nodeId: block.id,
      prepare: compileGeneratedFunction<CompiledFieldAnswerPreparationFunction>(
        this.expr,
        ['ctx'],
        () => this.buildFieldPreparationSource(block),
        { phase: 'answer-preparation' },
      ),
    }
  }

  /** Emits the source for a registered field's prepare function: a runtime branch on request method into the POST or GET path. */
  private buildFieldPreparationSource(block: FieldBlockASTNode): string {
    const emitter = CodeEmitter.strict()
    emitter.comment('StepAnswerPreparationCompiler.buildFieldPreparationSource')
    emitter.declareConst('isPost', 'ctx.request.method === "POST"')

    emitter.if(
      'isPost',
      () => this.compileRegisteredField(block, emitter, 'post'),
      () => this.compileRegisteredField(block, emitter, 'get'),
    )

    return emitter.toString()
  }

  compileMaterialisedPreparations(
    iterateNode: IterateASTNode,
  ): Map<TemplateNodeId, { nodeId: TemplateNodeId; prepare: CompiledMaterialisedFieldAnswerPreparationFunction }> {
    const entries = new Map<
      TemplateNodeId,
      { nodeId: TemplateNodeId; prepare: CompiledMaterialisedFieldAnswerPreparationFunction }
    >()
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return entries
    }

    this.collectMaterialisedPreparations(template, entries, 1)

    return entries
  }

  private collectMaterialisedPreparations(
    template: TemplateValue,
    entries: Map<
      TemplateNodeId,
      { nodeId: TemplateNodeId; prepare: CompiledMaterialisedFieldAnswerPreparationFunction }
    >,
    depth: number,
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node => isTemplateFieldNode(node) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateFieldNode(node)) {
        entries.set(node.id as TemplateNodeId, {
          nodeId: node.id as TemplateNodeId,
          prepare: this.compileMaterialisedFieldPreparation(node, depth),
        })

        return
      }

      const yieldTemplate = this.templates.getMapIterateYieldTemplate(node)

      if (yieldTemplate !== undefined) {
        this.collectMaterialisedPreparations(yieldTemplate, entries, depth + 1)
      }
    })
  }

  private compileMaterialisedFieldPreparation(
    field: TemplateNode,
    nestingDepth: number,
  ): CompiledMaterialisedFieldAnswerPreparationFunction {
    return compileGeneratedFunction<CompiledMaterialisedFieldAnswerPreparationFunction>(
      this.expr,
      ['ctx', 'scopeStack'],
      () => this.buildMaterialisedFieldPreparationSource(field, nestingDepth),
      { phase: 'answer-preparation' },
    )
  }

  private buildMaterialisedFieldPreparationSource(field: TemplateNode, nestingDepth: number): string {
    const emitter = CodeEmitter.strict()

    emitter.declareConst('isPost', 'ctx.request.method === "POST"')

    const pushFramesAndEmit = (level: number): void => {
      if (level < 0) {
        const codeExpr = this.templates.compileTemplateCodeExpression(field, emitter)

        emitter.if(
          'isPost',
          () => this.compileTemplateField(field, codeExpr, emitter, 'post'),
          () => this.compileTemplateField(field, codeExpr, emitter, 'get'),
        )

        return
      }

      const frame: IteratorScopeFrame = {
        itemVar: `scopeStack[${level}].item`,
        indexVar: `scopeStack[${level}].index`,
        inputLengthExpr: `scopeStack[${level}].inputLength`,
        rawItemExpr: `scopeStack[${level}].rawItem`,
      }

      this.expr.withIteratorFrame(frame, () => pushFramesAndEmit(level - 1))
    }

    pushFramesAndEmit(nestingDepth - 1)

    return emitter.toString()
  }

  private containsTemplateField(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(template, isTemplateFieldNode)
  }
}

/** Reads a transformer node into a TransformerFunctionCall, or undefined when it is not a named transformer. */
function readTransformerCall(value: unknown): TransformerFunctionCall | undefined {
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
