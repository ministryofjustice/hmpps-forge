import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { FieldBlockASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { arrayCode, Code, code, literal, objectCode, SafeCode } from '../../../compilation/codegen/Code'
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
    generator.comment('StepValidationCompiler.buildStepValidationSource')
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

    generator.comment('StepValidationCompiler.compileIterateBlock')
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

    generator.comment('StepValidationCompiler.compileTemplateFieldValidations')
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

    generator.comment(`StepValidationCompiler.compileFieldBlock — ${block.variant} ${describeBlockCode(block)}`)
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
    generator.comment('StepValidationCompiler.compileFieldValidationSlot')
    generator.scope(() => {
      const props = generator.const(
        'fieldValidationProps',
        objectCode([
          { key: 'blockId', value: blockId },
          { key: 'blockCode', value: blockCode },
          {
            key: 'run',
            value: this.compileFieldValidationRunFunction(
              value,
              blockId,
              blockCode,
              ruleIsActive,
              functionPrefix,
              generator,
            ),
          },
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

    generator.comment('StepValidationCompiler.compileDomainValidationSlot')
    generator.scope(() => {
      const props = generator.const(
        'domainValidationProps',
        objectCode([
          {
            key: 'run',
            value: this.compileDomainValidationRunFunction(value, ruleIsActive, generator),
          },
        ]),
      )

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
  ): Code {
    return generator.functionExpression(
      functionPrefix,
      [],
      body => {
        const errors = body.const('errors', code`[]`)
        const validationResults = body.let('validationResults')

        this.values.compileValue(value, body, validationResults)
        const evaluateValidationResults = this.compileValidationResultEvaluator(ruleIsActive, functionPrefix, body)
        const evaluateResults = code`${evaluateValidationResults}(${validationResults})`
        const failures = body.const(
          'validationFailures',
          this.expr.usesAwait ? code`await ${evaluateResults}` : evaluateResults,
        )

        body.forRange('failureIndex', literal(0), code`${failures}.length`, failureIndex => {
          const failure = body.const('validationFailure', code`${failures}[${failureIndex}]`)

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

  private compileDomainValidationRunFunction(value: unknown, ruleIsActive: Name, generator: CodeGenerator): Code {
    return generator.functionExpression(
      'validateStep',
      [],
      body => {
        const domainErrors = body.const('domainErrors', code`[]`)
        const validationResults = body.let('domainValidationResults')

        this.values.compileValue(value, body, validationResults)
        const evaluateValidationResults = this.compileValidationResultEvaluator(
          ruleIsActive,
          'evaluateStepResults',
          body,
        )
        const evaluateResults = code`${evaluateValidationResults}(${validationResults})`
        const failures = body.const(
          'domainValidationFailures',
          this.expr.usesAwait ? code`await ${evaluateResults}` : evaluateResults,
        )

        body.forRange('failureIndex', literal(0), code`${failures}.length`, failureIndex => {
          const failure = body.const('domainValidationFailure', code`${failures}[${failureIndex}]`)

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
    generator.comment('StepValidationCompiler.compileRuleFilterSetup')
    const activeGroupSet = generator.const('activeGroupSet', code`Object.create(null)`)
    const registerActiveGroup = generator.functionExpression(
      'registerActiveValidationGroup',
      ['activeGroup'],
      (body, [activeGroup]) => {
        body.assign(code`${activeGroupSet}[String(${activeGroup})]`, literal(true))
      },
    )

    generator.statement(
      code`(${FILTER}.groups.length > 0 ? ${FILTER}.groups : ${arrayCode([literal('default')])}).forEach(${registerActiveGroup})`,
    )
    const ruleIsActive = generator.function('ruleIsActive', ['rule'], (body, [rule]) => {
      const ruleGroups = body.const(
        'ruleGroups',
        code`${rule}.groups !== undefined && ${rule}.groups.length > 0 ? ${rule}.groups : ${arrayCode([
          literal('default'),
        ])}`,
      )
      const hasActiveGroup = body.functionExpression(
        'hasActiveValidationGroup',
        ['group'],
        (predicateBody, [group]) => {
          predicateBody.return(code`${activeGroupSet}[String(${group})] === true`)
        },
      )

      body.if(code`!${ruleGroups}.some(${hasActiveGroup})`, () => body.return(literal(false)))
      body.return(code`${rule}.submissionOnly !== true || ${FILTER}.includeSubmissionOnly === true`)
    })

    generator.blank()

    return ruleIsActive
  }

  private compileValidationResultEvaluator(ruleIsActive: Name, functionPrefix: string, generator: CodeGenerator): Name {
    generator.comment('StepValidationCompiler.compileValidationResultEvaluator')
    const usesAwait = this.expr.usesAwait

    return generator.function(
      `${functionPrefix}_results`,
      ['results'],
      (body, [results]) => {
        const failures = body.const('failures', code`[]`)
        const stack = body.const('validationStack', arrayCode([results]))

        body.while(code`${stack}.length > 0`, () => {
          const rule = body.const('validationRule', code`${stack}.pop()`)

          body.if(code`${rule} == null`, () => body.continue())
          body.if(code`Array.isArray(${rule})`, () => {
            const index = body.let('validationIndex', code`${rule}.length - 1`)

            body.while(code`${index} >= 0`, () => {
              const currentIndex = body.const('validationCurrentIndex', index)

              body.assign(index, code`${index} - 1`)
              body.statement(code`${stack}.push(${rule}[${currentIndex}])`)
            })
            body.continue()
          })
          body.if(code`!${ruleIsActive}(${rule})`, () => body.continue())

          const passed = body.let(
            'validationPassed',
            code`typeof ${rule}.evaluate === "function" ? ${rule}.evaluate() : ${rule}.passed`,
          )

          if (usesAwait) {
            body.assign(passed, code`await ${passed}`)
          }

          body.if(passed, () => body.continue())

          const message = body.let(
            'validationMessage',
            code`typeof ${rule}.message === "function" ? ${rule}.message() : ${rule}.message`,
          )
          const details = body.let(
            'validationDetails',
            code`typeof ${rule}.details === "function" ? ${rule}.details() : ${rule}.details`,
          )

          if (usesAwait) {
            body.assign(message, code`await ${message}`)
            body.assign(details, code`await ${details}`)
          }

          body.if(code`${message} === undefined`, () => body.assign(message, literal('')))
          body.statement(
            code`${failures}.push(${objectCode([
              { key: 'rule', value: rule },
              { key: 'message', value: message },
              { key: 'details', value: details },
            ])})`,
          )
        })
        body.return(failures)
      },
      { async: usesAwait },
    )
  }

  private compileValidationFunctionPrefix(fieldCode: unknown): string {
    if (typeof fieldCode !== 'string') {
      return 'validateField'
    }

    const namePart = fieldCode.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^([^A-Za-z_$])/, '_$1')

    return `validate_${namePart || 'field'}`
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
