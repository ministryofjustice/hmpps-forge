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
  CompilationPhase,
  compileGeneratedFunction,
  GENERATED_FUNCTION_HELPERS_PARAM,
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import { toRawOperand, type AuthoredValue } from '../../../contracts/models/authoredValue.type'
import type { FieldModel, TransformerPipeline } from '../../../contracts/models/fieldModel.type'
import type { AnswerPreparationModel } from '../contracts/answerPreparationModel.type'
import type { CompiledAnswerPreparationFunction } from '../../../contracts/compiled/compiledFunctions.type'

const CONTEXT = new Name('ctx')
const HELPERS = new Name(GENERATED_FUNCTION_HELPERS_PARAM)

/** Compiles GET/POST answer preparation for one generated step function. */
export default class StepAnswerPreparationCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly values: RuntimeValueCompiler

  private readonly templates: ScopedTemplateCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.values = new RuntimeValueCompiler(this.expr, {
      expressionErrorFallback: literal(undefined),
      expressionErrorMode: 'throw',
      omitUndefinedArrayItems: false,
    })
    this.templates = new ScopedTemplateCompiler(this.expr)
  }

  compile(model: AnswerPreparationModel): CompiledAnswerPreparationFunction {
    return compileGeneratedFunction<CompiledAnswerPreparationFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSource(model),
      { phase: CompilationPhase.ANSWER_PREPARATION, label: model.label },
    )
  }

  generateSource(model: AnswerPreparationModel): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(model))
  }

  private buildSource(model: AnswerPreparationModel): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    if (model.fields.length === 0) {
      generator.note('This step declares no form fields, so there is nothing to prepare.')
      const fieldPreparations = generator.const('fieldPreparations', code`[]`)

      generator.return(code`${CONTEXT}.workTasks.answerPreparation(${fieldPreparations})`)

      return generator
    }

    const mode = generator.const('answerPreparationMode', code`${CONTEXT}.request.method === "POST" ? "POST" : "GET"`)
    const fieldDefinitions = generator.const('fieldDefinitions', code`[]`)
    const usesInputValidation = model.fields.some(field => field.component.validatesInput)

    this.compileFieldDefinitions(model.fields, fieldDefinitions, generator)

    // Async discovery is monotonic within a build, so this read is safe only
    // because every field expression above has already been compiled; the
    // preparation bodies below add no authored expressions of their own.
    const usesAwait = this.expr.usesAwait
    const preparePostedFieldAnswer = this.compilePostedFieldPreparation(usesInputValidation, usesAwait, generator)
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
    fields: readonly FieldModel[],
    fieldDefinitions: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment('Field definitions')

    this.templates.compileFieldOccurrences(fields, generator, {
      loopComment: 'Fields produced by an iterator',
      compileLeaf: field => {
        this.compileFieldDefinitionEntry(field, fieldDefinitions, generator)
      },
    })
  }

  private compileFieldDefinitionEntry(field: FieldModel, fieldDefinitions: Name, generator: CodeGenerator): void {
    const isRegistered = field.iteratorPath.length === 0

    generator.comment(isRegistered ? `Field — ${field.label}` : `Template field — ${field.label}`)
    const codeExpression = this.fieldCodes.compileModelExpression(field.code, generator)

    // A registered field without a resolvable code cannot store an answer;
    // template fields keep their entry so iterator counts stay aligned.
    if (isRegistered && codeExpression === undefined) {
      return
    }

    generator.statement(
      callCode(code`${fieldDefinitions}.push`, [
        this.compileFieldDefinition(field, codeExpression ?? literal(undefined), generator),
      ]),
    )
  }

  private compileFieldDefinition(field: FieldModel, codeExpression: SafeCode, generator: CodeGenerator): Code {
    const definitionProperties: ObjectCodeProperty[] = [
      { key: 'code', value: codeExpression },
      { key: 'component', value: literal(field.component.variant) },
      { key: 'acceptsMultipleValues', value: literal(field.component.acceptsMultipleValues) },
      { key: 'validatesInput', value: literal(field.component.validatesInput) },
    ]

    this.addOptionalDefinitionProperty(
      definitionProperties,
      'formatSubmittedValue',
      this.compileTransformerCallback('formatSubmittedValue', field.formatters, generator),
    )
    this.addOptionalDefinitionProperty(
      definitionProperties,
      'evaluateDependentWhen',
      this.compileDependentWhenCallback(field.dependentWhen, generator),
    )
    this.addOptionalDefinitionProperty(
      definitionProperties,
      'resolveDefaultValue',
      this.compileDefaultValueCallback(field.defaultValue, generator),
    )
    this.addOptionalDefinitionProperty(
      definitionProperties,
      'parseStoredValue',
      this.compileTransformerCallback('parseStoredValue', field.parsers, generator),
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
    transformers: TransformerPipeline | undefined,
    generator: CodeGenerator,
  ): Code | undefined {
    if (transformers === undefined) {
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

  private compileDependentWhenCallback(
    dependentWhen: AuthoredValue | undefined,
    generator: CodeGenerator,
  ): Code | undefined {
    if (dependentWhen === undefined) {
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

  private compileDefaultValueCallback(
    defaultValue: AuthoredValue | undefined,
    generator: CodeGenerator,
  ): Code | undefined {
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
    usesInputValidation: boolean,
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

        if (usesInputValidation) {
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

  private compileTransformerPipeline(transformers: TransformerPipeline, value: Name, generator: CodeGenerator): void {
    generator.comment('Apply the configured transformers in order')
    const originalValue = generator.const('originalTransformerValue', value)
    const transformerFailed = generator.let('transformerFailed', literal(false))

    transformers.forEach(transformer => {
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

  private compileTransformerCall(transformer: TransformerPipeline[number], value: Name): Code {
    const argumentsCode = transformer.arguments.map(argument => this.expr.compileOperandCode(toRawOperand(argument)))

    return this.expr.compileFunctionCallCode(
      transformer.name,
      [code`${value}`, ...argumentsCode],
      transformer.node.node,
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

  private emitPushMutationCall(answerHistory: Name, value: SafeCode, source: string, generator: CodeGenerator): void {
    generator.statement(code`${HELPERS}.pushAnswerMutation(${answerHistory}, ${value}, ${source})`)
  }
}
