import { isTemplateNode } from '../../../chassis/contracts/ast/nodes'
import { toRawOperand } from '../../../chassis/contracts/models/authoredValue.type'
import {
  arrayCode,
  callCode,
  CodeFragment,
  code,
  literal,
  objectCode,
  propertyCode,
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
  renderGeneratedSource,
} from '../../../chassis/compilation/lowering/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../chassis/compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler from '../../../chassis/compilation/lowering/structures/ScopedTemplateCompiler'
import {
  FieldCodeKind,
  ValidationRulesKind,
  type FieldModel,
  type ValidationRulesModel,
} from '../../../chassis/contracts/models/fieldModel.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'
import type { ValidationModel } from '../contracts/validationModel.type'
import type { CompiledValidationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'

const CONTEXT = new IdentifierName('ctx')
const FILTER = new IdentifierName('filter')

/** Compiler for the validation phase: builds the generated function that runs a step's field and domain validation rules. */
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

    if (model.fields.length === 0 && model.domainRules === undefined) {
      generator.note('This step declares no validation rules.')
      generator.return(code`${CONTEXT}.workTasks.stepValidation([], [])`)

      return generator
    }

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
    fieldValidations: IdentifierName,
    ruleIsActive: IdentifierName,
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
    fieldValidations: IdentifierName,
    ruleIsActive: IdentifierName,
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
              field.source.id,
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
          field.source.id,
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
    fieldValidations: IdentifierName,
    ruleIsActive: IdentifierName,
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
    blockId: string | CodeFragment,
    blockCode: SafeCode,
    fieldValidations: IdentifierName,
    ruleIsActive: IdentifierName,
    functionPrefix: string,
    generator: CodeGenerator,
  ): void {
    const blockIdCode = typeof blockId === 'string' ? literal(blockId) : blockId
    const taskKey = typeof blockId === 'string' ? literal(`field:${blockId}`) : code`"field:" + String(${blockId})`

    generator.comment('Register field validation')
    generator.scope(() => {
      const runValidation = this.compileFieldValidationRunFunction(
        rules,
        blockIdCode,
        blockCode,
        ruleIsActive,
        functionPrefix,
        generator,
      )
      const props = generator.const(
        'fieldValidationProps',
        objectCode([
          { key: 'blockId', value: blockIdCode },
          { key: 'blockCode', value: blockCode },
          { key: 'run', value: runValidation },
        ]),
      )

      generator.statement(code`${fieldValidations}.push(${CONTEXT}.workTasks.fieldValidation(${taskKey}, ${props}))`)
    })
  }

  private compileDomainValidationSlot(
    rules: ValidationRulesModel | undefined,
    domainValidations: IdentifierName,
    ruleIsActive: IdentifierName,
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
    blockId: CodeFragment,
    blockCode: SafeCode,
    ruleIsActive: IdentifierName,
    functionPrefix: string,
    generator: CodeGenerator,
  ): IdentifierName {
    return generator.function(
      functionPrefix,
      [],
      body => {
        const validationResults = this.compileValidationRules(
          rules,
          this.compileValidationEvaluationPrefix(functionPrefix),
          body,
        )
        const fieldIdentity = objectCode([
          { key: 'blockId', value: blockId },
          { key: 'blockCode', value: blockCode },
        ])

        body.blank()
        this.compileValidationFailuresReturn(
          'collectFieldValidationFailures',
          [validationResults, ruleIsActive, fieldIdentity],
          body,
        )
      },
      { async: () => this.expr.usesAwait },
    )
  }

  private compileDomainValidationRunFunction(
    rules: ValidationRulesModel,
    ruleIsActive: IdentifierName,
    generator: CodeGenerator,
  ): IdentifierName {
    return generator.function(
      'validateStep',
      [],
      body => {
        const validationResults = this.compileValidationRules(rules, 'step', body)

        body.blank()
        this.compileValidationFailuresReturn('collectDomainValidationFailures', [validationResults, ruleIsActive], body)
      },
      { async: () => this.expr.usesAwait },
    )
  }

  private compileRuleFilterSetup(generator: CodeGenerator): IdentifierName {
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

  /**
   * Emits the run function's return: one runtime-library call that evaluates
   * the rules and shapes the failed ones into validation failures.
   *
   * Async discovery is monotonic within a build, so this `usesAwait` read is
   * safe only because this run function's rules were compiled just above; a
   * rule that discovered an async call flips the helper (and, via the async
   * thunk on the enclosing function, the run function itself) to async.
   */
  private compileValidationFailuresReturn(
    helperBaseName: string,
    helperArguments: readonly SafeCode[],
    generator: CodeGenerator,
  ): void {
    const helperName = this.expr.usesAwait ? `${helperBaseName}Async` : helperBaseName
    const helperCall = callCode(code`_forgeHelpers${propertyCode(helperName)}`, helperArguments)

    generator.return(this.expr.usesAwait ? code`await ${helperCall}` : helperCall)
  }

  private compileValidationRules(
    rules: ValidationRulesModel,
    functionPrefix: string,
    generator: CodeGenerator,
  ): IdentifierName {
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

  /** The analysis phase only includes fields that have validation, so a field with no rules here is a bug. */
  private resolveFieldRules(field: FieldModel): ValidationRulesModel {
    if (field.validation === undefined) {
      throw new ForgeInternalError(`Validation model field "${field.label}" carries no validation rules`)
    }

    return field.validation.rules
  }

  private compileTemplateBlockId(field: FieldModel): string | CodeFragment {
    if (!isTemplateNode(field.source)) {
      return field.source.id
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
