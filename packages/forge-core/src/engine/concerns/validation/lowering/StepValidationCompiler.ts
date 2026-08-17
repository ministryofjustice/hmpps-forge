/**
 * Compiles the step-validation function needed by one step.
 *
 * The generated function serves both validation rounds — the reachability
 * validities pass and the current-page operation — and takes a
 * `ValidationRuleFilter` selecting which rules the run executes. Group and
 * `submissionOnly` filtering happen before any rule condition is evaluated, so
 * rules outside the active groups never run. It evaluates the eligible
 * field/domain `validWhen` slots, recursively flattens arrays produced by
 * iterators, and turns failing validation results into field or domain failures.
 *
 * Static fields are already present in the shared AST, while fields inside MAP
 * iterators remain as template nodes. Iterator field validation emits loops over
 * the iterator input and evaluates the yield template in-place, so no runtime AST
 * nodes or overlays are created.
 *
 * Function calls stay indirect through FunctionRegistry because journey authors
 * provide those implementations. Registry metadata decides whether generated
 * source remains sync or becomes async; the runtime awaits both shapes.
 *
 * Generated-function construction failures throw ForgeCompilationError. There is
 * no secondary validation execution path.
 */
import { ASTNodeType } from '../../../contracts/ast/enums'
import { FieldBlockASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { ExpressionType } from '../../../../authoring/types/enums'
import CodeEmitter from '../../../compilation/codegen/CodeEmitter'
import FieldCodeEmitter from '../../../compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
  deriveScriptLabel,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, {
  isTemplateFieldNode,
} from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'

import type { CompiledValidationFunction } from '../../../contracts/compiled/compiledFunctions.type'

/**
 * Phase compiler for step-level validation generated functions.
 *
 * It owns the statement-shaped validation loop while delegating nested authored
 * values and predicates to the shared expression/value compilers.
 */
export default class StepValidationCompiler {
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
   * Builds the generated validation function used by the current-page and reachability rounds.
   */
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

  /**
   * Produces inspectable step-validation source for tests and local debugging.
   */
  generateStepValidationSource(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
  ): string {
    return buildGeneratedSource(this.expr, () =>
      this.buildStepValidationSource(fieldBlocks, domainValidWhen, iterateNodes),
    ).toString()
  }

  /**
   * Emits the full step-validation source: rule-filter setup, field validations, and domain validations.
   */
  private buildStepValidationSource(
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[],
  ): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    emitter.comment('StepValidationCompiler.buildStepValidationSource')
    this.compileRuleFilterSetup(emitter)

    const fieldValidationsVar = emitter.const('fieldValidations', '[]')
    const domainValidationsVar = emitter.const('domainValidations', '[]')

    for (const block of fieldBlocks) {
      this.compileFieldBlock(block, fieldValidationsVar, emitter)
    }

    for (const iterateNode of iterateNodes) {
      this.compileIterateBlock(iterateNode, fieldValidationsVar, emitter)
    }

    this.compileDomainValidationSlot(domainValidWhen, domainValidationsVar, emitter)
    emitter.emitBlank()

    emitter.return(`ctx.workTasks.stepValidation(${fieldValidationsVar}, ${domainValidationsVar})`)

    return emitter
  }

  /**
   * Emits validation for field blocks produced by MAP iterator templates.
   */
  private compileIterateBlock(iterateNode: IterateASTNode, fieldValidationsVar: string, emitter: CodeEmitter): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateFieldWithValidation(template)) {
      return
    }

    emitter.comment('StepValidationCompiler.compileIterateBlock')
    this.templates.compileMapIterator(iterateNode, emitter, yieldTemplate => {
      this.compileTemplateValidations(yieldTemplate, fieldValidationsVar, emitter)
    })
  }

  /**
   * Walks template values and emits validation where each field appears in iterator scope.
   */
  private compileTemplateValidations(template: TemplateValue, fieldValidationsVar: string, emitter: CodeEmitter): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.compileTemplateMapIterator(template, fieldValidationsVar, emitter)

        return
      }

      if (isTemplateFieldNode(template)) {
        const codeExpr = this.templates.compileTemplateCodeExpression(template, emitter)

        this.compileTemplateFieldValidations(template, codeExpr, fieldValidationsVar, emitter)
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.compileTemplateValidations(child as TemplateValue, fieldValidationsVar, emitter)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.compileTemplateValidations(item, fieldValidationsVar, emitter)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.compileTemplateValidations(item, fieldValidationsVar, emitter)
    })
  }

  /**
   * Emits validation for fields yielded by a nested MAP iterator template.
   */
  private compileTemplateMapIterator(
    templateNode: TemplateNode,
    fieldValidationsVar: string,
    emitter: CodeEmitter,
  ): void {
    this.templates.compileTemplateMapIterator(templateNode, emitter, yieldTemplate => {
      this.compileTemplateValidations(yieldTemplate, fieldValidationsVar, emitter)
    })
  }

  /**
   * Emits validWhen checks for one template field within the current iterator scope.
   */
  private compileTemplateFieldValidations(
    field: TemplateNode,
    codeExpr: string | undefined,
    fieldValidationsVar: string,
    emitter: CodeEmitter,
  ): void {
    const validWhen = field.properties?.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    emitter.comment('StepValidationCompiler.compileTemplateFieldValidations')
    const blockCodeExpr = codeExpr ?? 'undefined'
    const blockIdExpr = this.templates.compileTemplateInstanceIdExpression(field)

    this.expr.withSelfCodeExpression(codeExpr, () => {
      const dependentWhen = field.properties?.dependentWhen

      if (dependentWhen !== undefined) {
        const guardExpr = this.expr.compileOperand(dependentWhen)

        emitter.if(guardExpr, () => {
          this.compileFieldValidationSlot(validWhen, blockIdExpr, blockCodeExpr, fieldValidationsVar, emitter)
        })

        return
      }

      this.compileFieldValidationSlot(validWhen, blockIdExpr, blockCodeExpr, fieldValidationsVar, emitter)
    })
  }

  /**
   * Registered fields are guarded by dependentWhen before any validWhen checks run,
   * matching the request-time rule that hidden dependent fields should not fail.
   */
  private compileFieldBlock(block: FieldBlockASTNode, fieldValidationsVar: string, emitter: CodeEmitter): void {
    const validWhen = block.properties.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    emitter.comment(`StepValidationCompiler.compileFieldBlock — ${block.variant} ${describeBlockCode(block)}`)
    emitter.scope(() => {
      const selfCodeExpr = this.fieldCodes.compileRegisteredExpression(block.properties.code, emitter)
      const blockCodeExpr = selfCodeExpr ?? 'undefined'
      const hasDependentWhen =
        block.properties.dependentWhen !== undefined && this.expr.isCompilableNode(block.properties.dependentWhen)

      this.expr.withSelfCodeExpression(selfCodeExpr, () => {
        if (hasDependentWhen) {
          const guardExpr = this.expr.compileExpression(block.properties.dependentWhen!)

          emitter.if(guardExpr, () => {
            this.compileFieldValidationSlot(
              validWhen,
              JSON.stringify(block.id),
              blockCodeExpr,
              fieldValidationsVar,
              emitter,
            )
          })

          return
        }

        this.compileFieldValidationSlot(
          validWhen,
          JSON.stringify(block.id),
          blockCodeExpr,
          fieldValidationsVar,
          emitter,
        )
      })
    })
  }

  /**
   * Emits evaluation of one field validWhen slot and records any failing results.
   */
  private compileFieldValidationSlot(
    value: unknown,
    blockIdExpr: string,
    fallbackBlockCodeExpr: string,
    fieldValidationsVar: string,
    emitter: CodeEmitter,
  ): void {
    emitter.comment('StepValidationCompiler.compileFieldValidationSlot')
    emitter.scope(() => {
      const propsVar = emitter.const(
        'fieldValidationProps',
        `{
          blockId: ${blockIdExpr},
          blockCode: ${fallbackBlockCodeExpr},
          run: ${this.compileFieldValidationRunFunction(value, blockIdExpr, fallbackBlockCodeExpr)}
        }`,
      )

      emitter.code(
        `${fieldValidationsVar}.push(ctx.workTasks.fieldValidation("field:" + String(${blockIdExpr}), ${propsVar}));`,
      )
    })
  }

  /**
   * Emits evaluation of step-level domain validations into the domain failure list.
   */
  private compileDomainValidationSlot(value: unknown, domainValidationsVar: string, emitter: CodeEmitter): void {
    if (!hasConfiguredValue(value)) {
      return
    }

    emitter.comment('StepValidationCompiler.compileDomainValidationSlot')
    emitter.scope(() => {
      const propsVar = emitter.const(
        'domainValidationProps',
        `{
          run: ${this.compileDomainValidationRunFunction(value)}
        }`,
      )

      emitter.code(`${domainValidationsVar}.push(ctx.workTasks.domainValidation("domain:0", ${propsVar}));`)
    })
  }

  private compileFieldValidationRunFunction(value: unknown, blockIdExpr: string, blockCodeExpr: string): string {
    return this.compileAsyncFunctionExpression(emitter => {
      emitter.declareConst('errors', '[]')
      const resultsVar = emitter.let('validationResults')

      this.values.compileValue(value, emitter, resultsVar)
      this.emitValidationResultLoop(resultsVar, 'validation', emitter, (resultVar, messageVar, detailsVar) => {
        emitter.code(
          `errors.push({ blockId: ${blockIdExpr}, blockCode: ${blockCodeExpr}, passed: false, message: ${messageVar}, submissionOnly: ${resultVar}.submissionOnly === true, groups: ${resultVar}.groups, details: ${detailsVar} });`,
        )
      })
      emitter.return('errors')
    })
  }

  private compileDomainValidationRunFunction(value: unknown): string {
    return this.compileAsyncFunctionExpression(emitter => {
      emitter.declareConst('domainErrors', '[]')
      const resultsVar = emitter.let('domainValidationResults')

      this.values.compileValue(value, emitter, resultsVar)
      this.emitValidationResultLoop(resultsVar, 'domainValidation', emitter, (resultVar, messageVar, detailsVar) => {
        emitter.code(
          `domainErrors.push({ passed: false, message: ${messageVar}, submissionOnly: ${resultVar}.submissionOnly === true, groups: ${resultVar}.groups, details: ${detailsVar} });`,
        )
      })
      emitter.return('domainErrors')
    })
  }

  /**
   * Emits the rule-filter setup shared by every validation slot: the active-group
   * set derived from the caller's filter, and the predicate each rule must pass
   * before its condition is evaluated. A rule outside the active groups, or a
   * `submissionOnly` rule when the filter excludes them, never runs. Rules and
   * filters with no declared groups default to `['default']`.
   */
  private compileRuleFilterSetup(emitter: CodeEmitter): void {
    emitter.comment('StepValidationCompiler.compileRuleFilterSetup')
    emitter.declareConst('activeGroupSet', 'Object.create(null)')
    emitter.code(
      '(filter.groups.length > 0 ? filter.groups : ["default"]).forEach(function (activeGroup) { activeGroupSet[String(activeGroup)] = true; });',
    )
    emitter.emitBlock('function ruleIsActive(rule)', () => {
      const ruleGroupsVar = emitter.const(
        'ruleGroups',
        'rule.groups !== undefined && rule.groups.length > 0 ? rule.groups : ["default"]',
      )

      emitter.if(`!${ruleGroupsVar}.some(function (group) { return activeGroupSet[String(group)] === true; })`, () =>
        emitter.return('false'),
      )

      emitter.return('rule.submissionOnly !== true || filter.includeSubmissionOnly === true')
    })
    emitter.emitBlank()
  }

  /**
   * Emits the shared flatten/filter loop used by field and domain validation slots.
   */
  private emitValidationResultLoop(
    resultsVar: string,
    varPrefix: string,
    emitter: CodeEmitter,
    emitFailure: (resultVar: string, messageVar: string, detailsVar: string) => void,
  ): void {
    const awaitKeyword = this.expr.usesAwait ? 'await ' : ''
    const stackVar = emitter.const(`${varPrefix}Stack`, `[${resultsVar}]`)

    emitter.while(`${stackVar}.length > 0`, () => {
      const resultVar = emitter.const(`${varPrefix}Result`, `${stackVar}.pop()`)

      emitter.if(`${resultVar} == null`, () => emitter.continue())

      emitter.if(`Array.isArray(${resultVar})`, () => {
        const indexVar = emitter.let(`${varPrefix}Index`, `${resultVar}.length - 1`)

        emitter.while(`${indexVar} >= 0`, () => {
          const currentIndexVar = emitter.const(`${varPrefix}CurrentIndex`, indexVar)

          emitter.assign(indexVar, `${indexVar} - 1`)
          emitter.code(`${stackVar}.push(${resultVar}[${currentIndexVar}]);`)
        })
        emitter.continue()
      })

      emitter.if(`!ruleIsActive(${resultVar})`, () => emitter.continue())

      const passedVar = emitter.let(
        `${varPrefix}Passed`,
        `typeof ${resultVar}.evaluate === "function" ? ${resultVar}.evaluate() : ${resultVar}.passed`,
      )

      if (awaitKeyword) {
        emitter.assign(passedVar, `await ${passedVar}`)
      }

      emitter.if(passedVar, () => emitter.continue())

      const messageVar = emitter.let(
        `${varPrefix}Message`,
        `typeof ${resultVar}.message === "function" ? ${resultVar}.message() : ${resultVar}.message`,
      )
      const detailsVar = emitter.let(
        `${varPrefix}Details`,
        `typeof ${resultVar}.details === "function" ? ${resultVar}.details() : ${resultVar}.details`,
      )

      if (awaitKeyword) {
        emitter.assign(messageVar, `await ${messageVar}`)
        emitter.assign(detailsVar, `await ${detailsVar}`)
      }

      emitter.if(`${messageVar} === undefined`, () => emitter.assign(messageVar, '""'))
      emitFailure(resultVar, messageVar, detailsVar)
    })
  }

  private containsTemplateFieldWithValidation(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(
      template,
      node => isTemplateFieldNode(node) && hasConfiguredValue(node.properties?.validWhen),
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
}

function hasConfiguredValue(value: unknown): boolean {
  if (value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}

function describeBlockCode(block: FieldBlockASTNode): string {
  const code = block.properties.code

  return typeof code === 'string' ? `"${code}"` : '(dynamic code)'
}
