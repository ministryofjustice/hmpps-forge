import {
  arrayCode,
  callCode,
  CodeFragment,
  code,
  literal,
  objectCode,
  ObjectCodeProperty,
  SafeCode,
} from '../../../chassis/compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../chassis/compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../chassis/compilation/lowering/codegen/fragments/IdentifierName'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import FieldCodeEmitter from '../../../chassis/compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../chassis/compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  GENERATED_FUNCTION_RUNTIME_LIBRARY_PARAM,
  renderGeneratedSource,
} from '../../../chassis/compilation/lowering/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../chassis/compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler from '../../../chassis/compilation/lowering/structures/ScopedTemplateCompiler'
import { toRawOperand, type AuthoredValue } from '../../../chassis/contracts/models/authoredValue.type'
import type { FieldModel, TransformerPipeline } from '../../../chassis/contracts/models/fieldModel.type'
import type { AnswerPreparationModel } from '../contracts/answerPreparationModel.type'
import type { CompiledAnswerPreparationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'

const CONTEXT = new IdentifierName('ctx')
const HELPERS = new IdentifierName(GENERATED_FUNCTION_RUNTIME_LIBRARY_PARAM)

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

    this.compileFieldDefinitions(model.fields, fieldDefinitions, generator)
    const prepareFieldAnswer = this.compileFieldPreparationSelector(mode, generator)
    const fieldPreparations = this.compileFieldPreparationTasks(fieldDefinitions, mode, prepareFieldAnswer, generator)

    generator.return(code`${CONTEXT}.workTasks.answerPreparation(${fieldPreparations})`)

    return generator
  }

  private compileFieldDefinitions(
    fields: readonly FieldModel[],
    fieldDefinitions: IdentifierName,
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

  private compileFieldDefinitionEntry(
    field: FieldModel,
    fieldDefinitions: IdentifierName,
    generator: CodeGenerator,
  ): void {
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

  private compileFieldDefinition(field: FieldModel, codeExpression: SafeCode, generator: CodeGenerator): CodeFragment {
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

  private addOptionalDefinitionProperty(
    properties: ObjectCodeProperty[],
    key: string,
    value: CodeFragment | undefined,
  ): void {
    if (value === undefined) {
      return
    }

    properties.push({ key, value })
  }

  private compileTransformerCallback(
    functionName: string,
    transformers: TransformerPipeline | undefined,
    generator: CodeGenerator,
  ): CodeFragment | undefined {
    if (transformers === undefined) {
      return undefined
    }

    return generator.functionExpression(functionName, ['value'], (body, [value]) => {
      let pipelineAwaits = false
      const transformerThunks = transformers.map(transformer => {
        const compiledThunk = this.compileTransformerThunk(transformer, body)

        pipelineAwaits = pipelineAwaits || compiledThunk.usesAwait

        return compiledThunk.thunk
      })
      const pipeline = pipelineAwaits
        ? code`${HELPERS}.applyTransformerPipelineAsync`
        : code`${HELPERS}.applyTransformerPipeline`

      body.return(callCode(pipeline, [value, arrayCode(transformerThunks)]))
    })
  }

  private compileTransformerThunk(
    transformer: TransformerPipeline[number],
    generator: CodeGenerator,
  ): { thunk: CodeFragment; usesAwait: boolean } {
    let thunkUsesAwait = false
    const thunk = generator.functionExpression(
      this.transformerThunkName(transformer.name),
      ['transformedValue'],
      (body, [transformedValue]) => {
        thunkUsesAwait = this.expr.trackNestedFunctionAwait(() => {
          body.return(this.compileTransformerCall(transformer, transformedValue))
        })
      },
      { async: () => thunkUsesAwait },
    )

    return { thunk, usesAwait: thunkUsesAwait }
  }

  private transformerThunkName(transformerName: string): string {
    const nameParts = transformerName.split(/[^A-Za-z0-9]+/).filter(part => part.length > 0)

    return `apply${nameParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`
  }

  private compileDependentWhenCallback(
    dependentWhen: AuthoredValue | undefined,
    generator: CodeGenerator,
  ): CodeFragment | undefined {
    if (dependentWhen === undefined) {
      return undefined
    }

    return this.compileFunctionExpression('evaluateDependentWhen', generator, body => {
      const dependentWhenResult = body.let('dependentWhenResult')

      this.values.compileValue(dependentWhen, body, dependentWhenResult, {
        expressionErrorFallback: literal(true),
      })
      body.return(dependentWhenResult)
    })
  }

  private compileDefaultValueCallback(
    defaultValue: AuthoredValue | undefined,
    generator: CodeGenerator,
  ): CodeFragment | undefined {
    if (defaultValue === undefined) {
      return undefined
    }

    return this.compileFunctionExpression('resolveDefaultValue', generator, body => {
      const resolvedDefaultValue = body.let('defaultValue')

      this.values.compileValue(defaultValue, body, resolvedDefaultValue)
      body.return(resolvedDefaultValue)
    })
  }

  private compileFunctionExpression(
    prefix: string,
    generator: CodeGenerator,
    buildBody: (generator: CodeGenerator) => void,
  ): CodeFragment {
    let bodyUsesAwait = false

    return generator.functionExpression(
      prefix,
      [],
      body => {
        bodyUsesAwait = this.expr.trackNestedFunctionAwait(() => buildBody(body))
      },
      { async: () => bodyUsesAwait },
    )
  }

  private compileFieldPreparationSelector(mode: IdentifierName, generator: CodeGenerator): IdentifierName {
    generator.comment('Select preparation using the request method')

    return generator.const(
      'prepareFieldAnswer',
      code`${mode} === "POST" ? ${HELPERS}.preparePostedFieldAnswerGroup : ${HELPERS}.prepareStoredFieldAnswerGroup`,
    )
  }

  private compileFieldPreparationTasks(
    fieldDefinitions: IdentifierName,
    mode: IdentifierName,
    prepareFieldAnswer: IdentifierName,
    generator: CodeGenerator,
  ): IdentifierName {
    generator.comment('Create one preparation task per field; same-code fields form one variant group')
    const createFieldPreparation = generator.functionExpression(
      'createFieldPreparation',
      ['fieldGroup'],
      (body, [fieldGroup]) => {
        const fieldCode = body.const('fieldCode', code`${fieldGroup}[0].code`)
        const run = body.functionExpression('runFieldPreparation', [], runBody => {
          runBody.return(callCode(prepareFieldAnswer, [CONTEXT, fieldGroup]))
        })
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
    const fieldGroups = generator.const(
      'fieldGroups',
      callCode(code`${HELPERS}.groupFieldDefinitionsByCode`, [code`${fieldDefinitions}`]),
    )

    return generator.const('fieldPreparations', callCode(code`${fieldGroups}.map`, [createFieldPreparation]))
  }

  private compileTransformerCall(transformer: TransformerPipeline[number], value: IdentifierName): CodeFragment {
    const argumentsCode = transformer.arguments.map(argument => this.expr.compileOperandCode(toRawOperand(argument)))

    return this.expr.compileFunctionCallCode(
      transformer.name,
      [code`${value}`, ...argumentsCode],
      transformer.node.node,
    )
  }

}
