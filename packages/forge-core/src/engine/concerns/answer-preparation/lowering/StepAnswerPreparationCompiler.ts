import { ExpressionType, FunctionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { isASTNode } from '../../../contracts/ast/nodes'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { Code, code, literal, objectCode, SafeCode } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import FieldCodeEmitter from '../../../compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  compileGeneratedFunction,
  deriveScriptLabel,
  GENERATED_FUNCTION_HELPERS_PARAM,
  renderGeneratedSource,
  ScriptLabelSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler, {
  isTemplateFieldNode,
} from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import ForgeInternalError from '../../../errors/ForgeInternalError'
import type ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompiledAnswerPreparationFunction } from '../../../contracts/compiled/compiledFunctions.type'

interface TransformerFunctionCall {
  readonly name: string
  readonly arguments: unknown[]
}

type AnswerPreparationMode = 'POST' | 'GET'

const CONTEXT = new Name('ctx')
const HELPERS = new Name(GENERATED_FUNCTION_HELPERS_PARAM)

/** Compiles GET/POST answer preparation for one generated step function. */
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
      expressionErrorFallback: literal(undefined),
      expressionErrorMode: 'throw',
      omitUndefinedArrayItems: false,
    })
    this.templates = new ScopedTemplateCompiler(this.expr)
  }

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

  generateSource(fieldBlocks: FieldBlockASTNode[], iterateNodes: IterateASTNode[] = []): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(fieldBlocks, iterateNodes))
  }

  private buildSource(fieldBlocks: FieldBlockASTNode[], iterateNodes: IterateASTNode[]): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')
    generator.comment('StepAnswerPreparationCompiler.buildSource')
    const fieldPreparations = generator.const('fieldPreparations', code`[]`)

    if (fieldBlocks.length > 0 || iterateNodes.length > 0) {
      const isPost = generator.const('isPost', code`${CONTEXT}.request.method === "POST"`)

      generator.if(
        isPost,
        () => this.compileMode('POST', fieldBlocks, iterateNodes, fieldPreparations, generator),
        () => this.compileMode('GET', fieldBlocks, iterateNodes, fieldPreparations, generator),
      )
    } else {
      generator.note('This step declares no form fields, so there is nothing to prepare.')
    }

    generator.blank()
    generator.return(code`${CONTEXT}.workTasks.answerPreparation(${fieldPreparations})`)

    return generator
  }

  private compileMode(
    mode: AnswerPreparationMode,
    fieldBlocks: FieldBlockASTNode[],
    iterateNodes: IterateASTNode[],
    fieldPreparations: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment(`StepAnswerPreparationCompiler.compile${mode === 'POST' ? 'Post' : 'Get'}Mode`)

    fieldBlocks.forEach(block => {
      this.compileRegisteredField(block, mode, fieldPreparations, generator)
      generator.blank()
    })
    iterateNodes.forEach(iterateNode => {
      this.compileIterateBlock(iterateNode, mode, fieldPreparations, generator)
      generator.blank()
    })
  }

  private compileRegisteredField(
    block: FieldBlockASTNode,
    mode: AnswerPreparationMode,
    fieldPreparations: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment(
      `StepAnswerPreparationCompiler.compileRegisteredField — ${block.variant} ${describeFieldCode(block)}`,
    )
    generator.scope(() => {
      const codeExpression = this.fieldCodes.compileRegisteredExpression(block.properties.code, generator)

      if (codeExpression === undefined) {
        return
      }

      this.compileFieldPreparationSlot(
        block.properties,
        codeExpression,
        mode,
        fieldPreparations,
        block.variant,
        generator,
      )
    })
  }

  private compileFieldPath(
    properties: Record<string, unknown>,
    fieldCode: Name,
    mode: AnswerPreparationMode,
    variant: string,
    generator: CodeGenerator,
  ): void {
    if (mode === 'POST') {
      this.compilePostPath(properties, fieldCode, variant, generator)

      return
    }

    this.compileGetPath(properties, fieldCode, generator)
  }

  private compilePostPath(
    properties: Record<string, unknown>,
    fieldCode: Name,
    variant: string,
    generator: CodeGenerator,
  ): void {
    generator.comment('StepAnswerPreparationCompiler.compilePostPath')
    const answerHistory = generator.const(
      'answerHistory',
      code`${HELPERS}.ensureAnswerHistory(${CONTEXT}, ${fieldCode})`,
    )
    const entry = this.componentRegistry.get(variant)
    const multiple = entry?.multiple === true
    const rawValue = generator.let(
      'rawValue',
      code`${HELPERS}.normalizePostValue(${CONTEXT}.post[${fieldCode}], ${multiple})`,
    )

    if (entry?.inputSchema !== undefined) {
      generator.assign(
        rawValue,
        code`${HELPERS}.checkComponentInputValue(${CONTEXT}, ${variant}, ${rawValue}, ${multiple})`,
      )
    }

    this.emitPushMutationCall(answerHistory, rawValue, 'post', generator)

    const formatters = properties.formatters

    if (Array.isArray(formatters) && formatters.length > 0) {
      const formattedValue = generator.let('formattedValue', rawValue)

      this.compileTransformerPipeline(formatters, formattedValue, generator)

      generator.if(code`${formattedValue} !== ${rawValue}`, () => {
        this.emitPushMutationCall(answerHistory, formattedValue, 'processed', generator)
      })
    }

    this.compileDependentWhen(properties.dependentWhen, answerHistory, generator)
  }

  private compileGetPath(properties: Record<string, unknown>, fieldCode: Name, generator: CodeGenerator): void {
    generator.comment('StepAnswerPreparationCompiler.compileGetPath')
    const answerHistory = generator.let('answerHistory', code`${CONTEXT}.answers[${fieldCode}]`)

    generator.if(code`!(${answerHistory} && ${answerHistory}.current !== undefined)`, () => {
      generator.assign(answerHistory, code`${HELPERS}.ensureAnswerHistory(${CONTEXT}, ${fieldCode})`)
      this.compileDefaultValue(properties.defaultValue, answerHistory, generator)
    })

    const parsers = properties.parsers

    if (Array.isArray(parsers) && parsers.length > 0) {
      generator.if(code`${answerHistory} && ${answerHistory}.current !== undefined`, () => {
        const parsedValue = generator.let('parsedValue', code`${answerHistory}.current`)

        this.compileTransformerPipeline(parsers, parsedValue, generator)

        generator.if(code`${parsedValue} !== undefined`, () => {
          generator.assign(code`${answerHistory}.parsed`, parsedValue)
        })
      })
    }
  }

  private compileTransformerPipeline(transformers: unknown[], value: Name, generator: CodeGenerator): void {
    const compilableTransformers = transformers.filter(
      transformer => isASTNode(transformer) || this.expr.isTemplateNode(transformer),
    )

    if (compilableTransformers.length === 0) {
      return
    }

    generator.comment('StepAnswerPreparationCompiler.compileTransformerPipeline')
    const originalValue = generator.const('originalTransformerValue', value)
    const transformerFailed = generator.let('transformerFailed', literal(false))

    compilableTransformers.forEach(transformer => {
      generator.if(code`!${transformerFailed}`, () => {
        const transformerResult = generator.let('transformerResult')

        generator.tryCatch(
          () => generator.assign(transformerResult, this.compileTransformerCall(transformer, value)),
          'transformerError',
          transformerError => {
            generator.if(
              code`${transformerError} instanceof TypeError || (${transformerError} && ${transformerError}.cause instanceof TypeError)`,
              () => {
                generator.assign(value, originalValue)
                generator.assign(transformerFailed, literal(true))
              },
              () => generator.throw(transformerError),
            )
          },
        )
        generator.if(code`!${transformerFailed} && ${transformerResult} !== undefined`, () => {
          generator.assign(value, transformerResult)
        })
      })
    })
  }

  private compileDependentWhen(dependentWhen: unknown, answerHistory: Name, generator: CodeGenerator): void {
    if (!dependentWhen || (!isASTNode(dependentWhen) && !this.expr.isTemplateNode(dependentWhen))) {
      return
    }

    generator.comment('StepAnswerPreparationCompiler.compileDependentWhen')
    const dependentWhenResult = generator.let('dependentWhenResult')

    this.values.compileValue(dependentWhen, generator, dependentWhenResult, {
      expressionErrorFallback: literal(true),
    })
    generator.if(code`!${dependentWhenResult}`, () => {
      this.emitPushMutationCall(answerHistory, literal(undefined), 'dependentWhen', generator)
    })
  }

  private compileDefaultValue(defaultValue: unknown, answerHistory: Name, generator: CodeGenerator): void {
    generator.comment('StepAnswerPreparationCompiler.compileDefaultValue')

    if (defaultValue !== undefined) {
      const resolvedDefaultValue = generator.let('defaultValue')

      this.values.compileValue(defaultValue, generator, resolvedDefaultValue)
      this.emitPushMutationCall(answerHistory, resolvedDefaultValue, 'default', generator)

      return
    }

    this.emitPushMutationCall(answerHistory, literal(undefined), 'default', generator)
  }

  private compileIterateBlock(
    iterateNode: IterateASTNode,
    mode: AnswerPreparationMode,
    fieldPreparations: Name,
    generator: CodeGenerator,
  ): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return
    }

    generator.comment('StepAnswerPreparationCompiler.compileIterateBlock')
    this.templates.compileMapIterator(iterateNode, generator, yieldTemplate => {
      this.compileTemplateAnswerPreparation(yieldTemplate, mode, fieldPreparations, generator)
    })
  }

  private compileTemplateAnswerPreparation(
    template: TemplateValue,
    mode: AnswerPreparationMode,
    fieldPreparations: Name,
    generator: CodeGenerator,
  ): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.compileTemplateMapIterator(template, mode, fieldPreparations, generator)

        return
      }

      if (isTemplateFieldNode(template)) {
        const codeExpression = this.templates.compileTemplateCodeExpression(template, generator)

        this.compileTemplateField(template, codeExpression, mode, fieldPreparations, generator)
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.compileTemplateAnswerPreparation(child as TemplateValue, mode, fieldPreparations, generator)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.compileTemplateAnswerPreparation(item, mode, fieldPreparations, generator)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.compileTemplateAnswerPreparation(item, mode, fieldPreparations, generator)
    })
  }

  private compileTemplateMapIterator(
    templateNode: TemplateNode,
    mode: AnswerPreparationMode,
    fieldPreparations: Name,
    generator: CodeGenerator,
  ): void {
    this.templates.compileTemplateMapIterator(templateNode, generator, yieldTemplate => {
      this.compileTemplateAnswerPreparation(yieldTemplate, mode, fieldPreparations, generator)
    })
  }

  private compileTemplateField(
    field: TemplateNode,
    codeExpression: SafeCode | undefined,
    mode: AnswerPreparationMode,
    fieldPreparations: Name,
    generator: CodeGenerator,
  ): void {
    const properties = field.properties ?? {}
    const variant = typeof field.variant === 'string' ? field.variant : ''

    generator.comment('StepAnswerPreparationCompiler.compileTemplateField')
    generator.scope(() => {
      this.compileFieldPreparationSlot(
        properties,
        codeExpression ?? literal(undefined),
        mode,
        fieldPreparations,
        variant,
        generator,
      )
    })
  }

  private compileFieldPreparationSlot(
    properties: Record<string, unknown>,
    codeExpression: SafeCode,
    mode: AnswerPreparationMode,
    fieldPreparations: Name,
    variant: string,
    generator: CodeGenerator,
  ): void {
    const fieldCode = generator.const('answerPreparationCode', codeExpression)
    const props = generator.const(
      'fieldAnswerPreparationProps',
      objectCode([
        { key: 'code', value: fieldCode },
        { key: 'mode', value: literal(mode) },
        { key: 'run', value: this.compileFieldPreparationRunFunction(properties, fieldCode, mode, variant, generator) },
      ]),
    )

    generator.statement(
      code`${fieldPreparations}.push(${CONTEXT}.workTasks.fieldAnswerPreparation("field:" + String(${fieldCode}), ${props}))`,
    )
  }

  private compileFieldPreparationRunFunction(
    properties: Record<string, unknown>,
    fieldCode: Name,
    mode: AnswerPreparationMode,
    variant: string,
    generator: CodeGenerator,
  ): Code {
    return generator.functionExpression(
      'prepareFieldAnswer',
      [],
      body => {
        this.compileFieldPath(properties, fieldCode, mode, variant, body)
        this.compileFieldResult(fieldCode, mode, body)
      },
      { async: true },
    )
  }

  private compileFieldResult(fieldCode: Name, mode: AnswerPreparationMode, generator: CodeGenerator): void {
    const answerHistory = generator.const('preparedAnswerHistory', code`${CONTEXT}.answers[${fieldCode}]`)

    generator.return(
      objectCode([
        { key: 'code', value: fieldCode },
        { key: 'mode', value: literal(mode) },
        { key: 'current', value: code`${answerHistory} ? ${answerHistory}.current : undefined` },
        { key: 'parsed', value: code`${answerHistory} ? ${answerHistory}.parsed : undefined` },
        { key: 'mutations', value: code`${answerHistory} ? ${answerHistory}.mutations.slice() : []` },
      ]),
    )
  }

  private compileTransformerCall(transformerNode: unknown, value: Name): Code {
    const transformerCall = readTransformerCall(transformerNode)

    if (transformerCall === undefined) {
      throw new ForgeInternalError('Formatter entry is not a transformer function call')
    }

    const argumentsCode = transformerCall.arguments.map(argument => this.expr.compileOperandCode(argument))

    return this.expr.compileFunctionCallCode(transformerCall.name, [code`${value}`, ...argumentsCode], transformerNode)
  }

  private emitPushMutationCall(answerHistory: Name, value: SafeCode, source: string, generator: CodeGenerator): void {
    generator.statement(code`${HELPERS}.pushAnswerMutation(${answerHistory}, ${value}, ${source})`)
  }

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

  return {
    name: properties.name,
    arguments: Array.isArray(properties.arguments) ? properties.arguments : [],
  }
}

function readExpressionType(value: unknown): unknown {
  return isRecord(value) ? (value.expressionType ?? value.type) : undefined
}

function readProperties(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) && isRecord(value.properties) ? value.properties : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

function describeFieldCode(block: FieldBlockASTNode): string {
  const fieldCode = block.properties.code

  return typeof fieldCode === 'string' ? `"${fieldCode}"` : '(dynamic code)'
}
