import { ExpressionType, FunctionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { isASTNode } from '../../../contracts/ast/nodes'
import CodeEmitter from '../../../compilation/codegen/CodeEmitter'
import FieldCodeEmitter from '../../../compilation/lowering/emitters/FieldCodeEmitter'
import ScopedTemplateCompiler, {
  isTemplateFieldNode,
} from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
  deriveScriptLabel,
  ScriptLabelSource,
  GENERATED_FUNCTION_HELPERS_PARAM,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import type ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'

import type { CompiledAnswerPreparationFunction } from '../../../contracts/compiled/compiledFunctions.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

interface TransformerFunctionCall {
  readonly name: string
  readonly arguments: unknown[]
}

type AnswerPreparationMode = 'POST' | 'GET'

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
 * from their templates and run inline over the iterator input. Registry metadata keeps
 * sync-only functions as normal Functions and switches only async-dependent source
 * to AsyncFunction.
 *
 * Generated-function construction failures throw ForgeCompilationError. Runtime
 * callers still fail fast if defensive checks find a missing generated function.
 */
export default class StepAnswerPreparationCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly values: RuntimeValueCompiler

  private readonly templates: ScopedTemplateCompiler

  private readonly componentRegistry: ComponentRegistry

  constructor(dependencies: CompilationDependencies) {
    this.componentRegistry = dependencies.componentRegistry
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
   * Builds the generated answer-preparation function for a step. The step node
   * names the compiled script; fieldless steps would otherwise fall back to an
   * opaque counter. Journey-level aggregation passes undefined and labels from
   * the field nodes instead.
   */
  compile(
    stepNode: ScriptLabelSource | undefined,
    fieldBlocks: FieldBlockASTNode[],
    iterateNodes: IterateASTNode[] = [],
  ): CompiledAnswerPreparationFunction {
    return compileGeneratedFunction<CompiledAnswerPreparationFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSource(fieldBlocks, iterateNodes),
      { phase: 'answer-preparation', label: deriveScriptLabel([stepNode, ...fieldBlocks, ...iterateNodes]) },
    )
  }

  /**
   * Produces inspectable generated source for tests and local debugging.
   */
  generateSource(fieldBlocks: FieldBlockASTNode[], iterateNodes: IterateASTNode[] = []): string {
    return buildGeneratedSource(this.expr, () => this.buildSource(fieldBlocks, iterateNodes)).toString()
  }

  /**
   * Emits the request-method split and delegates field preparation to the selected mode.
   */
  private buildSource(fieldBlocks: FieldBlockASTNode[], iterateNodes: IterateASTNode[]): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    emitter.comment('StepAnswerPreparationCompiler.buildSource')
    const fieldPreparationsVar = emitter.const('fieldPreparations', '[]')

    if (fieldBlocks.length > 0 || iterateNodes.length > 0) {
      emitter.declareConst('isPost', 'ctx.request.method === "POST"')
      emitter.if(
        'isPost',
        () => this.compileMode('POST', fieldBlocks, iterateNodes, fieldPreparationsVar, emitter),
        () => this.compileMode('GET', fieldBlocks, iterateNodes, fieldPreparationsVar, emitter),
      )
    } else {
      emitter.note('This step declares no form fields, so there is nothing to prepare.')
    }

    emitter.emitBlank()
    emitter.return(`ctx.workTasks.answerPreparation(${fieldPreparationsVar})`)

    return emitter
  }

  /**
   * Emits either the POST or GET side of answer preparation for all fields.
   */
  private compileMode(
    mode: AnswerPreparationMode,
    fieldBlocks: FieldBlockASTNode[],
    iterateNodes: IterateASTNode[],
    fieldPreparationsVar: string,
    emitter: CodeEmitter,
  ): void {
    emitter.comment(`StepAnswerPreparationCompiler.compile${mode === 'POST' ? 'Post' : 'Get'}Mode`)

    for (const block of fieldBlocks) {
      this.compileRegisteredField(block, emitter, mode, fieldPreparationsVar)
      emitter.emitBlank()
    }

    for (const iterateNode of iterateNodes) {
      this.compileIterateBlock(iterateNode, emitter, mode, fieldPreparationsVar)
      emitter.emitBlank()
    }
  }

  /**
   * Emits one registered field block in the already-selected request mode.
   */
  private compileRegisteredField(
    block: FieldBlockASTNode,
    emitter: CodeEmitter,
    mode: AnswerPreparationMode,
    fieldPreparationsVar: string,
  ): void {
    emitter.comment(
      `StepAnswerPreparationCompiler.compileRegisteredField — ${block.variant} ${describeFieldCode(block)}`,
    )
    emitter.scope(() => {
      const codeExpr = this.fieldCodes.compileRegisteredExpression(block.properties.code, emitter)

      if (codeExpr === undefined) {
        return
      }

      this.compileFieldPreparationSlot(block.properties, emitter, codeExpr, mode, fieldPreparationsVar, block.variant)
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
    variant: string,
  ): void {
    if (mode === 'POST') {
      this.compilePostPath(properties, emitter, codeExpr, variant)

      return
    }

    this.compileGetPath(properties, emitter, codeExpr)
  }

  /**
   * Emits POST answer preparation: read submitted value, normalize it, check it against the
   * component's input schema, run formatters, then dependentWhen.
   */
  private compilePostPath(
    properties: Record<string, unknown>,
    emitter: CodeEmitter,
    codeExpr: string,
    variant: string,
  ): void {
    emitter.comment('StepAnswerPreparationCompiler.compilePostPath')
    const historyVar = emitter.const(
      'answerHistory',
      `${GENERATED_FUNCTION_HELPERS_PARAM}.ensureAnswerHistory(ctx, ${codeExpr})`,
    )
    const entry = this.componentRegistry.get(variant)
    const multipleLiteral = String(entry?.multiple === true)
    const rawVar = emitter.let(
      'rawValue',
      `${GENERATED_FUNCTION_HELPERS_PARAM}.normalizePostValue(ctx.post[${codeExpr}], ${multipleLiteral})`,
    )

    if (entry?.inputSchema !== undefined) {
      emitter.assign(
        rawVar,
        `${GENERATED_FUNCTION_HELPERS_PARAM}.checkComponentInputValue(ctx, ${JSON.stringify(variant)}, ${rawVar}, ${multipleLiteral})`,
      )
    }

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
   * Emits dependentWhen clearing after POST/default processing has produced a value.
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
   * MAP-yielded fields are prepared inside the same loop that render and
   * validation use, so dynamic field codes and scoped item references resolve
   * without request-time node registration.
   */
  private compileIterateBlock(
    iterateNode: IterateASTNode,
    emitter: CodeEmitter,
    mode: AnswerPreparationMode,
    fieldPreparationsVar: string,
  ): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return
    }

    emitter.comment('StepAnswerPreparationCompiler.compileIterateBlock')
    this.templates.compileMapIterator(iterateNode, emitter, yieldTemplate => {
      this.compileTemplateAnswerPreparation(yieldTemplate, emitter, mode, fieldPreparationsVar)
    })
  }

  /**
   * Walks template values and emits answer preparation at the iterator scope where each field appears.
   */
  private compileTemplateAnswerPreparation(
    template: TemplateValue,
    emitter: CodeEmitter,
    mode: AnswerPreparationMode,
    fieldPreparationsVar: string,
  ): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.compileTemplateMapIterator(template, emitter, mode, fieldPreparationsVar)

        return
      }

      if (isTemplateFieldNode(template)) {
        const codeExpr = this.templates.compileTemplateCodeExpression(template, emitter)

        this.compileTemplateField(template, codeExpr, emitter, mode, fieldPreparationsVar)
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.compileTemplateAnswerPreparation(child as TemplateValue, emitter, mode, fieldPreparationsVar)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.compileTemplateAnswerPreparation(item, emitter, mode, fieldPreparationsVar)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.compileTemplateAnswerPreparation(item, emitter, mode, fieldPreparationsVar)
    })
  }

  /**
   * Emits answer preparation for a nested MAP iterator template.
   */
  private compileTemplateMapIterator(
    templateNode: TemplateNode,
    emitter: CodeEmitter,
    mode: AnswerPreparationMode,
    fieldPreparationsVar: string,
  ): void {
    this.templates.compileTemplateMapIterator(templateNode, emitter, yieldTemplate => {
      this.compileTemplateAnswerPreparation(yieldTemplate, emitter, mode, fieldPreparationsVar)
    })
  }

  /**
   * Emits one field block produced inside an iterator template in the selected request mode.
   */
  private compileTemplateField(
    field: TemplateNode,
    codeExpr: string | undefined,
    emitter: CodeEmitter,
    mode: AnswerPreparationMode,
    fieldPreparationsVar: string,
  ): void {
    const resolvedCodeExpr = codeExpr ?? 'undefined'
    const properties = field.properties ?? {}
    const variant = typeof field.variant === 'string' ? field.variant : ''

    emitter.comment('StepAnswerPreparationCompiler.compileTemplateField')
    emitter.scope(() => {
      this.compileFieldPreparationSlot(properties, emitter, resolvedCodeExpr, mode, fieldPreparationsVar, variant)
    })
  }

  private compileFieldPreparationSlot(
    properties: Record<string, unknown>,
    emitter: CodeEmitter,
    codeExpr: string,
    mode: AnswerPreparationMode,
    fieldPreparationsVar: string,
    variant: string,
  ): void {
    const codeVar = emitter.const('answerPreparationCode', codeExpr)
    const propsVar = emitter.const(
      'fieldAnswerPreparationProps',
      [
        '{',
        `  code: ${codeVar},`,
        `  mode: ${JSON.stringify(mode)},`,
        indentEmbeddedSource(`run: ${this.compileFieldPreparationRunFunction(properties, codeVar, mode, variant)}`),
        '}',
      ].join('\n'),
    )

    emitter.code(
      `${fieldPreparationsVar}.push(ctx.workTasks.fieldAnswerPreparation("field:" + String(${codeVar}), ${propsVar}));`,
    )
  }

  private compileFieldPreparationRunFunction(
    properties: Record<string, unknown>,
    codeVar: string,
    mode: AnswerPreparationMode,
    variant: string,
  ): string {
    return this.compileAsyncFunctionExpression(emitter => {
      this.compileFieldPath(properties, emitter, codeVar, mode, variant)
      this.compileFieldResult(emitter, codeVar, mode)
    })
  }

  private compileFieldResult(emitter: CodeEmitter, codeVar: string, mode: AnswerPreparationMode): void {
    const historyVar = emitter.const('preparedAnswerHistory', `ctx.answers[${codeVar}]`)

    emitter.return(`{
      code: ${codeVar},
      mode: ${JSON.stringify(mode)},
      current: ${historyVar} ? ${historyVar}.current : undefined,
      parsed: ${historyVar} ? ${historyVar}.parsed : undefined,
      mutations: ${historyVar} ? ${historyVar}.mutations.slice() : []
    }`)
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

    if (transformerCall === undefined) {
      throw new ForgeInternalError('Formatter entry is not a transformer function call')
    }

    return this.compileTransformerFunctionCall(transformerCall, valueVar, transformerNode)
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

  private compileAsyncFunctionExpression(buildBody: (emitter: CodeEmitter) => void): string {
    const emitter = new CodeEmitter()

    buildBody(emitter)

    const body = emitter
      .toString()
      .split('\n')
      .map(line => (line.length === 0 ? line : `  ${line}`))
      .join('\n')

    return `async () => {\n${body}\n}`
  }

  /**
   * Fast pre-check used to avoid emitting iterator loops for templates with no fields.
   */
  private containsTemplateField(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(template, isTemplateFieldNode)
  }
}

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

function readExpressionType(value: unknown): unknown {
  if (!isRecord(value)) {
    return undefined
  }

  return value.expressionType ?? value.type
}

function readProperties(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value.properties)) {
    return undefined
  }

  return value.properties
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

function describeFieldCode(block: FieldBlockASTNode): string {
  const code = block.properties.code

  return typeof code === 'string' ? `"${code}"` : '(dynamic code)'
}

// Multi-line values embedded in an object-literal template need every line
// shifted to the property's indent, or CodeEmitter's common-indent
// normalisation leaves the lines ragged in the generated source.
function indentEmbeddedSource(source: string): string {
  return source
    .split('\n')
    .map(line => (line.length === 0 ? line : `  ${line}`))
    .join('\n')
}
