import { ExpressionType, FunctionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { isASTNode } from '../../../contracts/ast/nodes'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import {
  callCode,
  Code,
  code,
  literal,
  objectCode,
  ObjectCodeProperty,
  SafeCode,
} from '../../../compilation/codegen/Code'
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

interface AnswerPreparationFeatures {
  usesInputValidation: boolean
}

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

    if (fieldBlocks.length === 0 && iterateNodes.length === 0) {
      generator.note('This step declares no form fields, so there is nothing to prepare.')
      const fieldPreparations = generator.const('fieldPreparations', code`[]`)

      generator.return(code`${CONTEXT}.workTasks.answerPreparation(${fieldPreparations})`)

      return generator
    }

    const mode = generator.const('answerPreparationMode', code`${CONTEXT}.request.method === "POST" ? "POST" : "GET"`)
    const fieldDefinitions = generator.const('fieldDefinitions', code`[]`)
    const features: AnswerPreparationFeatures = { usesInputValidation: false }

    this.compileFieldDefinitions(fieldBlocks, iterateNodes, fieldDefinitions, features, generator)

    const usesAwait = this.expr.usesAwait
    const preparePostedFieldAnswer = this.compilePostedFieldPreparation(features, usesAwait, generator)
    const prepareStoredFieldAnswer = this.compileStoredFieldPreparation(usesAwait, generator)
    const prepareFieldAnswer = this.compileFieldPreparationSelector(
      preparePostedFieldAnswer,
      prepareStoredFieldAnswer,
      mode,
      generator,
    )
    const fieldPreparations = this.compileFieldPreparationTasks(fieldDefinitions, mode, prepareFieldAnswer, generator)

    generator.return(code`${CONTEXT}.workTasks.answerPreparation(${fieldPreparations})`)

    return generator
  }

  private compileFieldDefinitions(
    fieldBlocks: FieldBlockASTNode[],
    iterateNodes: IterateASTNode[],
    fieldDefinitions: Name,
    features: AnswerPreparationFeatures,
    generator: CodeGenerator,
  ): void {
    generator.comment('Field definitions')

    fieldBlocks.forEach(block => {
      this.compileRegisteredFieldDefinition(block, fieldDefinitions, features, generator)
    })
    iterateNodes.forEach(iterateNode => {
      this.compileIterateBlock(iterateNode, fieldDefinitions, features, generator)
    })
  }

  private compileRegisteredFieldDefinition(
    block: FieldBlockASTNode,
    fieldDefinitions: Name,
    features: AnswerPreparationFeatures,
    generator: CodeGenerator,
  ): void {
    generator.comment(`Field — ${block.variant} ${describeFieldCode(block)}`)
    const codeExpression = this.fieldCodes.compileRegisteredExpression(block.properties.code, generator)

    if (codeExpression === undefined) {
      return
    }

    generator.statement(
      callCode(code`${fieldDefinitions}.push`, [
        this.compileFieldDefinition(block.properties, codeExpression, block.variant, features, generator),
      ]),
    )
  }

  private compileFieldDefinition(
    properties: Record<string, unknown>,
    codeExpression: SafeCode,
    variant: string,
    features: AnswerPreparationFeatures,
    generator: CodeGenerator,
  ): Code {
    const component = this.componentRegistry.get(variant)
    const definitionProperties: ObjectCodeProperty[] = [
      { key: 'code', value: codeExpression },
      { key: 'component', value: literal(variant) },
      { key: 'acceptsMultipleValues', value: literal(component?.multiple === true) },
      { key: 'validatesInput', value: literal(component?.inputSchema !== undefined) },
    ]

    features.usesInputValidation ||= component?.inputSchema !== undefined
    this.addOptionalDefinitionProperty(
      definitionProperties,
      'formatSubmittedValue',
      this.compileTransformerCallback('formatSubmittedValue', properties.formatters, generator),
    )
    this.addOptionalDefinitionProperty(
      definitionProperties,
      'evaluateDependentWhen',
      this.compileDependentWhenCallback(properties.dependentWhen, generator),
    )
    this.addOptionalDefinitionProperty(
      definitionProperties,
      'resolveDefaultValue',
      this.compileDefaultValueCallback(properties.defaultValue, generator),
    )
    this.addOptionalDefinitionProperty(
      definitionProperties,
      'parseStoredValue',
      this.compileTransformerCallback('parseStoredValue', properties.parsers, generator),
    )

    return objectCode(definitionProperties)
  }

  private addOptionalDefinitionProperty(properties: ObjectCodeProperty[], key: string, value: Code | undefined): void {
    if (value === undefined) {
      return
    }

    properties.push({ key, value })
  }

  private compileTransformerCallback(
    functionName: string,
    transformers: unknown,
    generator: CodeGenerator,
  ): Code | undefined {
    if (!Array.isArray(transformers) || !this.hasCompilableTransformer(transformers)) {
      return undefined
    }

    return generator.functionExpression(
      functionName,
      ['value'],
      (body, [value]) => {
        const transformedValue = body.let('transformedValue', value)

        this.compileTransformerPipeline(transformers, transformedValue, body)
        body.return(transformedValue)
      },
      { async: () => this.expr.usesAwait },
    )
  }

  private compileDependentWhenCallback(dependentWhen: unknown, generator: CodeGenerator): Code | undefined {
    if (!dependentWhen || (!isASTNode(dependentWhen) && !this.expr.isTemplateNode(dependentWhen))) {
      return undefined
    }

    return generator.functionExpression(
      'evaluateDependentWhen',
      [],
      body => {
        const dependentWhenResult = body.let('dependentWhenResult')

        this.values.compileValue(dependentWhen, body, dependentWhenResult, {
          expressionErrorFallback: literal(true),
        })
        body.return(dependentWhenResult)
      },
      { async: () => this.expr.usesAwait },
    )
  }

  private compileDefaultValueCallback(defaultValue: unknown, generator: CodeGenerator): Code | undefined {
    if (defaultValue === undefined) {
      return undefined
    }

    return generator.functionExpression(
      'resolveDefaultValue',
      [],
      body => {
        const resolvedDefaultValue = body.let('defaultValue')

        this.values.compileValue(defaultValue, body, resolvedDefaultValue)
        body.return(resolvedDefaultValue)
      },
      { async: () => this.expr.usesAwait },
    )
  }

  private compilePostedFieldPreparation(
    features: AnswerPreparationFeatures,
    usesAwait: boolean,
    generator: CodeGenerator,
  ): Name {
    generator.comment('Prepare a submitted field')

    return generator.function(
      'preparePostedFieldAnswer',
      ['field'],
      (body, [field]) => {
        const fieldCode = body.const('fieldCode', code`${field}.code`)
        const component = body.const('component', code`${field}.component`)
        const acceptsMultipleValues = body.const('acceptsMultipleValues', code`${field}.acceptsMultipleValues`)
        const answerHistory = body.const(
          'answerHistory',
          code`${HELPERS}.ensureAnswerHistory(${CONTEXT}, ${fieldCode})`,
        )
        const rawValue = body.let(
          'rawValue',
          code`${HELPERS}.normalizePostValue(${CONTEXT}.post[${fieldCode}], ${acceptsMultipleValues})`,
        )

        if (features.usesInputValidation) {
          body.if(code`${field}.validatesInput`, () => {
            body.assign(
              rawValue,
              code`${HELPERS}.checkComponentInputValue(${CONTEXT}, ${component}, ${rawValue}, ${acceptsMultipleValues})`,
            )
          })
        }

        this.emitPushMutationCall(answerHistory, rawValue, 'post', body)

        body.if(code`${field}.formatSubmittedValue !== undefined`, () => {
          const formattedValue = body.const(
            'formattedValue',
            this.maybeAwait(code`${field}.formatSubmittedValue(${rawValue})`, usesAwait),
          )

          body.if(code`${formattedValue} !== ${rawValue}`, () => {
            this.emitPushMutationCall(answerHistory, formattedValue, 'processed', body)
          })
        })

        body.if(code`${field}.evaluateDependentWhen !== undefined`, () => {
          const dependentWhenResult = body.const(
            'dependentWhenResult',
            this.maybeAwait(code`${field}.evaluateDependentWhen()`, usesAwait),
          )

          body.if(code`!${dependentWhenResult}`, () => {
            this.emitPushMutationCall(answerHistory, literal(undefined), 'dependentWhen', body)
          })
        })

        this.compileFieldResult(fieldCode, literal('POST'), body)
      },
      { async: true },
    )
  }

  private compileStoredFieldPreparation(usesAwait: boolean, generator: CodeGenerator): Name {
    generator.comment('Prepare a stored field')

    return generator.function(
      'prepareStoredFieldAnswer',
      ['field'],
      (body, [field]) => {
        const fieldCode = body.const('fieldCode', code`${field}.code`)
        const answerHistory = body.let('answerHistory', code`${CONTEXT}.answers[${fieldCode}]`)

        body.if(code`!(${answerHistory} && ${answerHistory}.current !== undefined)`, () => {
          body.assign(answerHistory, code`${HELPERS}.ensureAnswerHistory(${CONTEXT}, ${fieldCode})`)
          const defaultValue = body.const(
            'defaultValue',
            code`${field}.resolveDefaultValue === undefined ? undefined : ${this.maybeAwait(
              code`${field}.resolveDefaultValue()`,
              usesAwait,
            )}`,
          )

          this.emitPushMutationCall(answerHistory, defaultValue, 'default', body)
        })

        body.if(
          code`${answerHistory} && ${answerHistory}.current !== undefined && ${field}.parseStoredValue !== undefined`,
          () => {
            const parsedValue = body.const(
              'parsedValue',
              this.maybeAwait(code`${field}.parseStoredValue(${answerHistory}.current)`, usesAwait),
            )

            body.if(code`${parsedValue} !== undefined`, () => {
              body.assign(code`${answerHistory}.parsed`, parsedValue)
            })
          },
        )

        this.compileFieldResult(fieldCode, literal('GET'), body)
      },
      { async: true },
    )
  }

  private compileFieldPreparationSelector(
    preparePostedFieldAnswer: Name,
    prepareStoredFieldAnswer: Name,
    mode: Name,
    generator: CodeGenerator,
  ): Name {
    generator.comment('Select preparation using the request method')

    return generator.const(
      'prepareFieldAnswer',
      code`${mode} === "POST" ? ${preparePostedFieldAnswer} : ${prepareStoredFieldAnswer}`,
    )
  }

  private compileFieldPreparationTasks(
    fieldDefinitions: Name,
    mode: Name,
    prepareFieldAnswer: Name,
    generator: CodeGenerator,
  ): Name {
    generator.comment('Create one preparation task per field')
    const createFieldPreparation = generator.functionExpression(
      'createFieldPreparation',
      ['field'],
      (body, [field]) => {
        const fieldCode = body.const('fieldCode', code`${field}.code`)
        const run = body.functionExpression(
          'runFieldPreparation',
          [],
          runBody => {
            runBody.return(callCode(prepareFieldAnswer, [field]))
          },
          { async: true },
        )
        const props = body.const(
          'fieldAnswerPreparationProps',
          objectCode([
            { key: 'code', value: fieldCode },
            { key: 'mode', value: mode },
            { key: 'run', value: run },
          ]),
        )

        body.return(
          callCode(code`${CONTEXT}.workTasks.fieldAnswerPreparation`, [code`"field:" + String(${fieldCode})`, props]),
        )
      },
    )

    return generator.const('fieldPreparations', callCode(code`${fieldDefinitions}.map`, [createFieldPreparation]))
  }

  private compileTransformerPipeline(transformers: unknown[], value: Name, generator: CodeGenerator): void {
    const compilableTransformers = transformers.filter(
      transformer => isASTNode(transformer) || this.expr.isTemplateNode(transformer),
    )

    if (compilableTransformers.length === 0) {
      return
    }

    generator.comment('Apply the configured transformers in order')
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

  private compileIterateBlock(
    iterateNode: IterateASTNode,
    fieldDefinitions: Name,
    features: AnswerPreparationFeatures,
    generator: CodeGenerator,
  ): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return
    }

    generator.comment('Fields produced by an iterator')
    this.templates.compileMapIterator(iterateNode, generator, yieldTemplate => {
      this.compileTemplateAnswerPreparation(yieldTemplate, fieldDefinitions, features, generator)
    })
  }

  private compileTemplateAnswerPreparation(
    template: TemplateValue,
    fieldDefinitions: Name,
    features: AnswerPreparationFeatures,
    generator: CodeGenerator,
  ): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.compileTemplateMapIterator(template, fieldDefinitions, features, generator)

        return
      }

      if (isTemplateFieldNode(template)) {
        const codeExpression = this.templates.compileTemplateCodeExpression(template, generator)

        this.compileTemplateField(template, codeExpression, fieldDefinitions, features, generator)
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.compileTemplateAnswerPreparation(child as TemplateValue, fieldDefinitions, features, generator)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.compileTemplateAnswerPreparation(item, fieldDefinitions, features, generator)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.compileTemplateAnswerPreparation(item, fieldDefinitions, features, generator)
    })
  }

  private compileTemplateMapIterator(
    templateNode: TemplateNode,
    fieldDefinitions: Name,
    features: AnswerPreparationFeatures,
    generator: CodeGenerator,
  ): void {
    this.templates.compileTemplateMapIterator(templateNode, generator, yieldTemplate => {
      this.compileTemplateAnswerPreparation(yieldTemplate, fieldDefinitions, features, generator)
    })
  }

  private compileTemplateField(
    field: TemplateNode,
    codeExpression: SafeCode | undefined,
    fieldDefinitions: Name,
    features: AnswerPreparationFeatures,
    generator: CodeGenerator,
  ): void {
    const properties = field.properties ?? {}
    const variant = typeof field.variant === 'string' ? field.variant : ''

    generator.comment(`Template field — ${variant || 'unknown component'}`)
    generator.statement(
      callCode(code`${fieldDefinitions}.push`, [
        this.compileFieldDefinition(properties, codeExpression ?? literal(undefined), variant, features, generator),
      ]),
    )
  }

  private compileFieldResult(fieldCode: SafeCode, mode: SafeCode, generator: CodeGenerator): void {
    const answerHistory = generator.const('preparedAnswerHistory', code`${CONTEXT}.answers[${fieldCode}]`)

    generator.return(
      objectCode([
        { key: 'code', value: fieldCode },
        { key: 'mode', value: mode },
        { key: 'current', value: code`${answerHistory} ? ${answerHistory}.current : undefined` },
        { key: 'parsed', value: code`${answerHistory} ? ${answerHistory}.parsed : undefined` },
        { key: 'mutations', value: code`${answerHistory} ? ${answerHistory}.mutations.slice() : []` },
      ]),
    )
  }

  private maybeAwait(expression: Code, usesAwait: boolean): Code {
    return usesAwait ? code`await ${expression}` : expression
  }

  private hasCompilableTransformer(transformers: unknown[]): boolean {
    return transformers.some(transformer => isASTNode(transformer) || this.expr.isTemplateNode(transformer))
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
