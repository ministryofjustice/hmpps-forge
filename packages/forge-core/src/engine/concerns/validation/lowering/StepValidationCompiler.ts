import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { FieldBlockASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
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
  compileGeneratedFunction,
  deriveScriptLabel,
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler, {
  isTemplateFieldNode,
} from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
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

  compileStepValidation(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
  ): CompiledValidationFunction {
    return compileGeneratedFunction<CompiledValidationFunction>(
      this.expr,
      ['ctx', 'filter'],
      () => this.buildStepValidationSource(fieldBlocks, domainValidWhen, iterateNodes),
      { phase: 'validation', label: deriveScriptLabel([stepNode]) },
    )
  }

  generateStepValidationSource(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
  ): string {
    return renderGeneratedSource(this.expr, () =>
      this.buildStepValidationSource(fieldBlocks, domainValidWhen, iterateNodes),
    )
  }

  private buildStepValidationSource(
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[],
  ): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx', 'filter'])

    generator.directive('use strict')
    generator.comment('Validation groups')
    const ruleIsActive = this.compileRuleFilterSetup(generator)
    const fieldValidations = generator.const('fieldValidations', code`[]`)
    const domainValidations = generator.const('domainValidations', code`[]`)

    fieldBlocks.forEach(block => {
      this.compileFieldBlock(block, fieldValidations, ruleIsActive, generator)
    })
    iterateNodes.forEach(iterateNode => {
      this.compileIterateBlock(iterateNode, fieldValidations, ruleIsActive, generator)
    })

    this.compileDomainValidationSlot(domainValidWhen, domainValidations, ruleIsActive, generator)
    generator.blank()
    generator.return(code`${CONTEXT}.workTasks.stepValidation(${fieldValidations}, ${domainValidations})`)

    return generator
  }

  private compileIterateBlock(
    iterateNode: IterateASTNode,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateFieldWithValidation(template)) {
      return
    }

    generator.comment('Repeated field validations')
    this.templates.compileMapIterator(iterateNode, generator, yieldTemplate => {
      this.compileTemplateValidations(yieldTemplate, fieldValidations, ruleIsActive, generator)
    })
  }

  private compileTemplateValidations(
    template: TemplateValue,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.compileTemplateMapIterator(template, fieldValidations, ruleIsActive, generator)

        return
      }

      if (isTemplateFieldNode(template)) {
        const codeExpression = this.templates.compileTemplateCodeExpression(template, generator)

        this.compileTemplateFieldValidations(template, codeExpression, fieldValidations, ruleIsActive, generator)
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.compileTemplateValidations(child as TemplateValue, fieldValidations, ruleIsActive, generator)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.compileTemplateValidations(item, fieldValidations, ruleIsActive, generator)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.compileTemplateValidations(item, fieldValidations, ruleIsActive, generator)
    })
  }

  private compileTemplateMapIterator(
    templateNode: TemplateNode,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    this.templates.compileTemplateMapIterator(templateNode, generator, yieldTemplate => {
      this.compileTemplateValidations(yieldTemplate, fieldValidations, ruleIsActive, generator)
    })
  }

  private compileTemplateFieldValidations(
    field: TemplateNode,
    codeExpression: SafeCode | undefined,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    const validWhen = field.properties?.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    generator.comment('Template field validation')
    const blockCode = codeExpression ?? literal(undefined)
    const blockId = this.templates.compileTemplateInstanceIdExpression(field)
    const functionPrefix = this.compileValidationFunctionPrefix(field.properties?.code)

    this.expr.withSelfCodeExpression(codeExpression, () => {
      const dependentWhen = field.properties?.dependentWhen

      if (dependentWhen !== undefined) {
        generator.if(this.expr.compileOperandCode(dependentWhen), () => {
          this.compileFieldValidationSlot(
            validWhen,
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
        validWhen,
        blockId,
        blockCode,
        fieldValidations,
        ruleIsActive,
        functionPrefix,
        generator,
      )
    })
  }

  private compileFieldBlock(
    block: FieldBlockASTNode,
    fieldValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    const validWhen = block.properties.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    generator.comment(`Field validation — ${block.variant} ${describeBlockCode(block)}`)
    generator.scope(() => {
      const selfCodeExpression = this.fieldCodes.compileRegisteredExpression(block.properties.code, generator)
      const blockCode = selfCodeExpression ?? literal(undefined)
      const dependentWhen = block.properties.dependentWhen
      const functionPrefix = this.compileValidationFunctionPrefix(block.properties.code)

      this.expr.withSelfCodeExpression(selfCodeExpression, () => {
        if (dependentWhen !== undefined && this.expr.isCompilableNode(dependentWhen)) {
          generator.if(this.expr.compileExpressionCode(dependentWhen), () => {
            this.compileFieldValidationSlot(
              validWhen,
              literal(block.id),
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
          validWhen,
          literal(block.id),
          blockCode,
          fieldValidations,
          ruleIsActive,
          functionPrefix,
          generator,
        )
      })
    })
  }

  private compileFieldValidationSlot(
    value: unknown,
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
        value,
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
    value: unknown,
    domainValidations: Name,
    ruleIsActive: Name,
    generator: CodeGenerator,
  ): void {
    if (!hasConfiguredValue(value)) {
      return
    }

    generator.comment('Register step validation')
    generator.scope(() => {
      const runValidation = this.compileDomainValidationRunFunction(value, ruleIsActive, generator)
      const props = generator.const('domainValidationProps', objectCode([{ key: 'run', value: runValidation }]))

      generator.statement(code`${domainValidations}.push(${CONTEXT}.workTasks.domainValidation("domain:0", ${props}))`)
    })
  }

  private compileFieldValidationRunFunction(
    value: unknown,
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
          value,
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

  private compileDomainValidationRunFunction(value: unknown, ruleIsActive: Name, generator: CodeGenerator): Name {
    return generator.function(
      'validateStep',
      [],
      body => {
        const domainErrors = body.const('domainErrors', code`[]`)
        const validationResults = this.compileValidationRules(value, 'step', body)
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
    const helperName = this.expr.usesAwait ? 'collectValidationFailuresAsync' : 'collectValidationFailures'
    const helperCall = code`_forgeHelpers${propertyCode(helperName)}(${validationResults}, ${ruleIsActive})`

    return generator.const(resultPrefix, this.expr.usesAwait ? code`await ${helperCall}` : helperCall)
  }

  private compileValidationRules(value: unknown, functionPrefix: string, generator: CodeGenerator): Name {
    if (Array.isArray(value) && value.every(rule => this.isDirectValidationRule(rule))) {
      const validationRules = this.expr.withValidationFunctionPrefix(functionPrefix, () =>
        value.map(rule => this.expr.compileOperandCode(rule)),
      )

      generator.comment('Build validation rules')

      return generator.const('validationRules', arrayCode(validationRules))
    }

    const validationResults = generator.let('validationResults')

    this.expr.withValidationFunctionPrefix(functionPrefix, () => {
      this.values.compileValue(value, generator, validationResults)
    })

    return validationResults
  }

  private isDirectValidationRule(value: unknown): boolean {
    if (this.expr.isTemplateNode(value)) {
      return value.originalType === ASTNodeType.EXPRESSION && value.expressionType === ExpressionType.VALIDATION
    }

    if (!this.expr.isCompilableNode(value) || value.type !== ASTNodeType.EXPRESSION) {
      return false
    }

    return 'expressionType' in value && value.expressionType === ExpressionType.VALIDATION
  }

  private compileValidationFunctionPrefix(fieldCode: unknown): string {
    if (typeof fieldCode !== 'string') {
      return 'validateField'
    }

    const namePart = fieldCode.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^([^A-Za-z_$])/, '_$1')

    return `validate_${namePart || 'field'}`
  }

  private compileValidationEvaluationPrefix(functionPrefix: string): string {
    if (functionPrefix === 'validateField') {
      return 'field'
    }

    return functionPrefix.replace(/^validate_/, '')
  }

  private containsTemplateFieldWithValidation(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(
      template,
      node => isTemplateFieldNode(node) && hasConfiguredValue(node.properties?.validWhen),
    )
  }
}

function hasConfiguredValue(value: unknown): boolean {
  if (value === undefined) {
    return false
  }

  return Array.isArray(value) ? value.length > 0 : true
}

function describeBlockCode(block: FieldBlockASTNode): string {
  const fieldCode = block.properties.code

  return typeof fieldCode === 'string' ? `"${fieldCode}"` : '(dynamic code)'
}
