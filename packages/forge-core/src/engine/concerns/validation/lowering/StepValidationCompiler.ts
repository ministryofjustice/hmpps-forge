import { isTemplateNode } from '../../../contracts/ast/nodes'
import { toRawOperand } from '../../../contracts/models/authoredValue.type'
import {
  arrayCode,
  callCode,
  Code,
  code,
  literal,
  objectCode,
  propertyCode,
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
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import {
  FieldCodeKind,
  ValidationRulesKind,
  type FieldModel,
  type ValidationRulesModel,
} from '../../../contracts/models/fieldModel.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'
import type { ValidationModel } from '../contracts/validationModel.type'
import type { CompiledValidationFunction } from '../../../contracts/compiled/compiledFunctions.type'

const CONTEXT = new Name('ctx')
const FILTER = new Name('filter')

/** Phase compiler for step-level validation generated functions. */
export default class StepValidationCompiler {
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

  compileStepValidation(model: ValidationModel): CompiledValidationFunction {
    return compileGeneratedFunction<CompiledValidationFunction>(
      this.expr,
      ['ctx', 'filter'],
      () => this.buildStepValidationSource(model),
      { phase: CompilationPhase.VALIDATION, label: model.label },
    )
  }

  generateStepValidationSource(model: ValidationModel): string {
    return renderGeneratedSource(this.expr, () => this.buildStepValidationSource(model))
  }

  private buildStepValidationSource(model: ValidationModel): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx', 'filter'])

    generator.directive('use strict')
    generator.comment('Validation groups')
    const ruleIsActive = this.compileRuleFilterSetup(generator)
    const fieldValidations = generator.const('fieldValidations', code`[]`)
    const domainValidations = generator.const('domainValidations', code`[]`)

    this.templates.compileFieldOccurrences(model.fields, generator, {
      loopComment: 'Repeated field validations',
      compileLeaf: field => {
        this.compileFieldOccurrence(field, fieldValidations, ruleIsActive, generator)
      },
    })

    this.compileDomainValidationSlot(model.domainRules, domainValidations, ruleIsActive, generator)
    generator.blank()
    generator.return(code`${CONTEXT}.workTasks.stepValidation(${fieldValidations}, ${domainValidations})`)

    return generator
  }

  private compileFieldOccurrence(
    field: FieldModel,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    if (field.iteratorPath.length === 0) {
      this.compileRegisteredField(field, fieldValidations, ruleIsActive, generator)

      return
    }

    this.compileTemplateField(field, fieldValidations, ruleIsActive, generator)
  }

  private compileRegisteredField(
    field: FieldModel,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    const rules = this.resolveFieldRules(field)

    generator.comment(`Field validation — ${field.label}`)
    generator.scope(() => {
      const selfCodeExpression = this.fieldCodes.compileModelExpression(field.code, generator)
      const blockCode = selfCodeExpression ?? literal(undefined)
      const dependentWhen = field.dependentWhen === undefined ? undefined : toRawOperand(field.dependentWhen)
      const functionPrefix = this.compileValidationFunctionPrefix(field)

      this.expr.withSelfCodeExpression(selfCodeExpression, () => {
        if (dependentWhen !== undefined && this.expr.isCompilableNode(dependentWhen)) {
          generator.if(this.expr.compileExpressionCode(dependentWhen), () => {
            this.compileFieldValidationSlot(
              rules,
              literal(field.source.id),
              blockCode,
              fieldValidations,
              ruleIsActive,
              functionPrefix,
              generator,
            )
          })

          return
        }

        this.compileFieldValidationSlot(
          rules,
          literal(field.source.id),
          blockCode,
          fieldValidations,
          ruleIsActive,
          functionPrefix,
          generator,
        )
      })
    })
  }

  private compileTemplateField(
    field: FieldModel,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    const rules = this.resolveFieldRules(field)

    generator.comment('Template field validation')
    const codeExpression = this.fieldCodes.compileModelExpression(field.code, generator)
    const blockCode = codeExpression ?? literal(undefined)
    const blockId = this.compileTemplateBlockId(field)
    const functionPrefix = this.compileValidationFunctionPrefix(field)

    this.expr.withSelfCodeExpression(codeExpression, () => {
      const dependentWhen = field.dependentWhen === undefined ? undefined : toRawOperand(field.dependentWhen)

      if (dependentWhen !== undefined) {
        generator.if(this.expr.compileOperandCode(dependentWhen), () => {
          this.compileFieldValidationSlot(
            rules,
            blockId,
            blockCode,
            fieldValidations,
            ruleIsActive,
            functionPrefix,
            generator,
          )
        })

        return
      }

      this.compileFieldValidationSlot(
        rules,
        blockId,
        blockCode,
        fieldValidations,
        ruleIsActive,
        functionPrefix,
        generator,
      )
    })
  }

  private compileFieldValidationSlot(
    rules: ValidationRulesModel,
    blockId: Code,
    blockCode: SafeCode,
    fieldValidations: Name,
    ruleIsActive: Name,
    functionPrefix: string,
    generator: CodeGenerator,
  ): void {
    generator.comment('Register field validation')
    generator.scope(() => {
      const runValidation = this.compileFieldValidationRunFunction(
        rules,
        blockId,
        blockCode,
        ruleIsActive,
        functionPrefix,
        generator,
      )
      const props = generator.const(
        'fieldValidationProps',
        objectCode([
          { key: 'blockId', value: blockId },
          { key: 'blockCode', value: blockCode },
          { key: 'run', value: runValidation },
        ]),
      )

      generator.statement(
        code`${fieldValidations}.push(${CONTEXT}.workTasks.fieldValidation("field:" + String(${blockId}), ${props}))`,
      )
    })
  }

  private compileDomainValidationSlot(
    rules: ValidationRulesModel | undefined,
    domainValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    if (rules === undefined) {
      return
    }

    generator.comment('Register step validation')
    generator.scope(() => {
      const runValidation = this.compileDomainValidationRunFunction(rules, ruleIsActive, generator)
      const props = generator.const('domainValidationProps', objectCode([{ key: 'run', value: runValidation }]))

      generator.statement(code`${domainValidations}.push(${CONTEXT}.workTasks.domainValidation("domain:0", ${props}))`)
    })
  }

  private compileFieldValidationRunFunction(
    rules: ValidationRulesModel,
    blockId: Code,
    blockCode: SafeCode,
    ruleIsActive: Name,
    functionPrefix: string,
    generator: CodeGenerator,
  ): Name {
    return generator.function(
      functionPrefix,
      [],
      body => {
        const errors = body.const('errors', code`[]`)
        const validationResults = this.compileValidationRules(
          rules,
          this.compileValidationEvaluationPrefix(functionPrefix),
          body,
        )
        const failures = this.compileValidationFailures(validationResults, ruleIsActive, 'validationFailures', body)

        body.forRange('failureIndex', literal(0), code`${failures}.length`, failureIndex => {
          const failure = body.const('validationFailure', code`${failures}[${failureIndex}]`)

          body.note('Return this failed rule as a field validation error.')
          body.statement(
            code`${errors}.push(${objectCode([
              { key: 'blockId', value: blockId },
              { key: 'blockCode', value: blockCode },
              { key: 'passed', value: literal(false) },
              { key: 'message', value: code`${failure}.message` },
              { key: 'submissionOnly', value: code`${failure}.rule.submissionOnly === true` },
              { key: 'groups', value: code`${failure}.rule.groups` },
              { key: 'details', value: code`${failure}.details` },
            ])})`,
          )
        })
        body.return(errors)
      },
      { async: true },
    )
  }

  private compileDomainValidationRunFunction(
    rules: ValidationRulesModel,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): Name {
    return generator.function(
      'validateStep',
      [],
      body => {
        const domainErrors = body.const('domainErrors', code`[]`)
        const validationResults = this.compileValidationRules(rules, 'step', body)
        const failures = this.compileValidationFailures(
          validationResults,
          ruleIsActive,
          'domainValidationFailures',
          body,
        )

        body.forRange('failureIndex', literal(0), code`${failures}.length`, failureIndex => {
          const failure = body.const('domainValidationFailure', code`${failures}[${failureIndex}]`)

          body.note('Return this failed rule as a step validation error.')
          body.statement(
            code`${domainErrors}.push(${objectCode([
              { key: 'passed', value: literal(false) },
              { key: 'message', value: code`${failure}.message` },
              { key: 'submissionOnly', value: code`${failure}.rule.submissionOnly === true` },
              { key: 'groups', value: code`${failure}.rule.groups` },
              { key: 'details', value: code`${failure}.details` },
            ])})`,
          )
        })
        body.return(domainErrors)
      },
      { async: true },
    )
  }

  private compileRuleFilterSetup(generator: CodeGenerator): Name {
    generator.comment('Active validation groups')
    generator.note('Use the default group when the request does not select one.')
    const requestedGroups = generator.const(
      'requestedGroups',
      code`${FILTER}.groups.length > 0 ? ${FILTER}.groups : ${arrayCode([literal('default')])}`,
    )
    const activeGroups = generator.const('activeGroups', code`new Set(${requestedGroups})`)

    const ruleIsActive = generator.function('ruleIsActive', ['rule'], (body, [rule]) => {
      body.note('Use the default group when the rule does not declare one.')
      const ruleGroups = body.const(
        'ruleGroups',
        code`Array.isArray(${rule}.groups) && ${rule}.groups.length > 0 ? ${rule}.groups : ${arrayCode([literal('default')])}`,
      )

      body.note('A rule runs when any of its groups is active.')
      const isActiveValidationGroup = body.functionExpression(
        'isActiveValidationGroup',
        ['group'],
        (predicateBody, [group]) => {
          predicateBody.return(code`${activeGroups}.has(${group})`)
        },
      )
      const hasActiveGroup = body.const('hasActiveGroup', callCode(code`${ruleGroups}.some`, [isActiveValidationGroup]))

      body.if(code`!${hasActiveGroup}`, () => body.return(literal(false)))

      body.note('Submission-only rules are skipped unless this validation run includes them.')
      const submissionOnlyIsIncluded = body.const(
        'submissionOnlyIsIncluded',
        code`${FILTER}.includeSubmissionOnly === true`,
      )

      body.return(code`${rule}.submissionOnly !== true || ${submissionOnlyIsIncluded}`)
    })

    generator.blank()

    return ruleIsActive
  }

  private compileValidationFailures(
    validationResults: Name,
    ruleIsActive: Name,
    resultPrefix: string,
    generator: CodeGenerator,
  ): Name {
    generator.comment('Evaluate validation results')
    // Async discovery is monotonic within a build, so this read is safe only
    // because this slot's rules were compiled by compileValidationRules just
    // above; a rule that discovered an async call flips the helper here.
    const helperName = this.expr.usesAwait ? 'collectValidationFailuresAsync' : 'collectValidationFailures'
    const helperCall = code`_forgeHelpers${propertyCode(helperName)}(${validationResults}, ${ruleIsActive})`

    return generator.const(resultPrefix, this.expr.usesAwait ? code`await ${helperCall}` : helperCall)
  }

  private compileValidationRules(rules: ValidationRulesModel, functionPrefix: string, generator: CodeGenerator): Name {
    if (rules.kind === ValidationRulesKind.DIRECT) {
      const validationRules = this.expr.withValidationFunctionPrefix(functionPrefix, () =>
        rules.rules.map(rule => this.expr.compileOperandCode(rule.node)),
      )

      generator.comment('Build validation rules')

      return generator.const('validationRules', arrayCode(validationRules))
    }

    const validationResults = generator.let('validationResults')

    this.expr.withValidationFunctionPrefix(functionPrefix, () => {
      this.values.compileValue(rules.value, generator, validationResults)
    })

    return validationResults
  }

  /** Analysis only models validating fields, so absent rules are an impossible state. */
  private resolveFieldRules(field: FieldModel): ValidationRulesModel {
    if (field.validation === undefined) {
      throw new ForgeInternalError(`Validation model field "${field.label}" carries no validation rules`)
    }

    return field.validation.rules
  }

  private compileTemplateBlockId(field: FieldModel): Code {
    if (!isTemplateNode(field.source)) {
      return literal(field.source.id)
    }

    return this.templates.compileTemplateInstanceIdExpression(field.source)
  }

  private compileValidationFunctionPrefix(field: FieldModel): string {
    if (field.code?.kind !== FieldCodeKind.STATIC) {
      return 'validateField'
    }

    const namePart = field.code.value.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^([^A-Za-z_$])/, '_$1')

    return `validate_${namePart || 'field'}`
  }

  private compileValidationEvaluationPrefix(functionPrefix: string): string {
    if (functionPrefix === 'validateField') {
      return 'field'
    }

    return functionPrefix.replace(/^validate_/, '')
  }
}
