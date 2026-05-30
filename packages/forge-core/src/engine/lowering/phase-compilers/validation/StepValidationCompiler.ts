/**
 * Compiles the validation functions needed by one step.
 *
 * On-entry validation is a small group selector for validateOnEntry. Submit
 * validation evaluates the field/domain `validWhen` slots, recursively flattens
 * arrays produced by iterators, and turns failing validation results into field
 * or domain failures.
 *
 * Static fields are already present in the shared AST, while fields inside MAP
 * iterators remain as template nodes. Iterator field validation emits loops over
 * the iterator input and evaluates the yield template in-place, so no runtime AST
 * nodes or overlays are created.
 *
 * Function calls stay indirect through FunctionRegistry because journey authors
 * provide those implementations. Registry metadata decides whether generated
 * source remains sync or becomes async; controllers await both shapes.
 *
 * Generated-function construction failures throw ForgeCompilationError. There is
 * no secondary validation execution path.
 */
import { FieldBlockASTNode, StepASTNode, StepEntryValidationAST } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import CodeEmitter from '../../emitters/CodeEmitter'
import FieldCodeEmitter from '../../emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, { isTemplateFieldNode } from '../../structures/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../../structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'

import type {
  CompiledEntryValidationFunction,
  CompiledValidationFunction,
} from '../../../contracts/compiled/compiledFunctions.type'

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
   * Builds the generated validation function used by submit hooks and reachability checks.
   */
  compileOnSubmitValidation(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
  ): CompiledValidationFunction | undefined {
    return compileGeneratedFunction<CompiledValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups'],
      () => this.buildSubmitValidationSource(fieldBlocks, domainValidWhen, iterateNodes),
      { phase: 'validation' },
    )
  }

  /**
   * Builds the generated group-selector used before rendering a GET request.
   */
  compileOnEntryValidation(entries: StepEntryValidationAST[] | undefined): CompiledEntryValidationFunction | undefined {
    if (entries === undefined || entries.length === 0) {
      return undefined
    }

    return compileGeneratedFunction<CompiledEntryValidationFunction>(
      this.expr,
      ['ctx'],
      () => this.buildEntryValidationSource(entries),
      { phase: 'entry-validation' },
    )
  }

  /**
   * Produces inspectable submit-validation source for tests and local debugging.
   */
  generateOnSubmitValidationSource(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
  ): string {
    return buildGeneratedSource(this.expr, () =>
      this.buildSubmitValidationSource(fieldBlocks, domainValidWhen, iterateNodes),
    )
  }

  /**
   * Produces inspectable entry-validation source for tests and local debugging.
   */
  generateOnEntryValidationSource(entries: StepEntryValidationAST[]): string {
    return buildGeneratedSource(this.expr, () => this.buildEntryValidationSource(entries))
  }

  /**
   * Emits the full submit-validation source: active-group setup, field validations, and domain validations.
   */
  private buildSubmitValidationSource(
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[],
  ): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    emitter.comment('StepValidationCompiler.buildSubmitValidationSource')
    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)

    emitter.declareConst('errors', '[]')
    emitter.declareConst('domainErrors', '[]')

    for (const block of fieldBlocks) {
      this.compileFieldBlock(block, emitter)
    }

    for (const iterateNode of iterateNodes) {
      this.compileIterateBlock(iterateNode, emitter)
    }

    this.compileDomainValidationSlot(domainValidWhen, emitter)
    emitter.emitBlank()

    emitter.return(
      '{ isValid: errors.length === 0 && domainErrors.length === 0, fieldFailures: errors, domainFailures: domainErrors }',
    )

    return emitter.toString()
  }

  /**
   * Emits the entry-validation group selector used by GET rendering.
   */
  private buildEntryValidationSource(entries: StepEntryValidationAST[]): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    emitter.comment('StepValidationCompiler.buildEntryValidationSource')
    emitter.declareConst('groups', '[]')
    emitter.declareConst('seen', 'Object.create(null)')
    this.compileEntryValidationGroupAccumulator(emitter)

    entries.forEach(entry => this.compileEntryValidationRule(entry, emitter))
    emitter.return('groups')

    return emitter.toString()
  }

  /**
   * Emits a tiny local helper so repeated entry groups keep their first declaration position.
   */
  private compileEntryValidationGroupAccumulator(emitter: CodeEmitter): void {
    emitter.comment('StepValidationCompiler.compileEntryValidationGroupAccumulator')
    emitter.emitBlock('function addGroup(group)', () => {
      const groupKeyVar = emitter.const('groupKey', 'String(group)')

      emitter.if(`!seen[${groupKeyVar}]`, () => {
        emitter.assign(`seen[${groupKeyVar}]`, 'true')
        emitter.code(`groups.push(${groupKeyVar});`)
      })
    })
  }

  /**
   * Emits one validateOnEntry rule, preserving unconditional entries as direct group additions.
   */
  private compileEntryValidationRule(entry: StepEntryValidationAST, emitter: CodeEmitter): void {
    emitter.comment('StepValidationCompiler.compileEntryValidationRule')
    emitter.scope(() => {
      if (entry.when === true) {
        this.compileEntryValidationGroups(entry.groups, emitter)

        return
      }

      const whenVar = this.compileEntryValidationWhen(entry.when, emitter)

      emitter.if(whenVar, () => this.compileEntryValidationGroups(entry.groups, emitter))
    })
  }

  /**
   * Emits a validateOnEntry predicate as a named boolean so generated source reads as a rule guard.
   */
  private compileEntryValidationWhen(when: StepEntryValidationAST['when'], emitter: CodeEmitter): string {
    if (when === true) {
      return 'true'
    }

    const predicateExpr = this.expr.compileExpression(when)

    return emitter.const('entryWhen', `Boolean(${predicateExpr})`)
  }

  /**
   * Emits the declared validateOnEntry groups through addGroup to preserve uniqueness and ordering.
   */
  private compileEntryValidationGroups(groups: readonly string[], emitter: CodeEmitter): void {
    groups.forEach(group => {
      emitter.code(`addGroup(${JSON.stringify(group)});`)
    })
  }

  /**
   * Emits the caller-selected validation groups as a lookup table for generated rules.
   */
  private compileActiveGroups(emitter: CodeEmitter): void {
    emitter.comment('StepValidationCompiler.compileActiveGroups')
    emitter.declareConst('activeGroups', 'Array.isArray(groups) && groups.length > 0 ? groups : ["default"]')
    emitter.declareConst('activeGroupSet', 'Object.create(null)')

    const activeGroupIndexVar = emitter.let('activeGroupIndex', '0')

    emitter.while(`${activeGroupIndexVar} < activeGroups.length`, () => {
      const activeGroupVar = emitter.const('activeGroup', `activeGroups[${activeGroupIndexVar}]`)

      emitter.assign(activeGroupIndexVar, `${activeGroupIndexVar} + 1`)
      emitter.assign(`activeGroupSet[String(${activeGroupVar})]`, 'true')
    })
  }

  /**
   * Emits small generated helpers that keep group filtering local to the validation function.
   */
  private compileValidationRuntimeHelpers(emitter: CodeEmitter): void {
    emitter.comment('StepValidationCompiler.compileValidationRuntimeHelpers')
    emitter.emitBlock('function validationGroupsActive(value)', () => {
      emitter.declareConst('validationGroups', 'Array.isArray(value) && value.length > 0 ? value : ["default"]')

      const validationGroupIndexVar = emitter.let('validationGroupIndex', '0')

      emitter.while(`${validationGroupIndexVar} < validationGroups.length`, () => {
        const validationGroupVar = emitter.const('validationGroup', `validationGroups[${validationGroupIndexVar}]`)

        emitter.assign(validationGroupIndexVar, `${validationGroupIndexVar} + 1`)
        emitter.if(`activeGroupSet[String(${validationGroupVar})] === true`, () => emitter.return('true'))
      })
      emitter.return('false')
    })
  }

  /**
   * Emits validation for field blocks produced by MAP iterator templates.
   */
  private compileIterateBlock(iterateNode: IterateASTNode, emitter: CodeEmitter): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined) {
      return
    }

    const templateFields = this.findTemplateFieldsWithValidation(template)

    if (templateFields.length === 0) {
      return
    }

    emitter.comment('StepValidationCompiler.compileIterateBlock')
    this.templates.compileMapIterator(iterateNode, emitter, () => {
      templateFields.forEach(templateField => {
        const codeExpr = this.templates.compileTemplateCodeExpression(templateField, emitter)

        this.compileTemplateFieldValidations(templateField, codeExpr, emitter)
      })
    })
  }

  /**
   * Emits validWhen checks for one template field within the current iterator scope.
   */
  private compileTemplateFieldValidations(
    field: TemplateNode,
    codeExpr: string | undefined,
    emitter: CodeEmitter,
  ): void {
    const validWhen = field.properties?.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    emitter.comment('StepValidationCompiler.compileTemplateFieldValidations')
    const blockCodeExpr = codeExpr ?? 'undefined'
    const blockIdExpr = this.fieldCodes.compileIteratorFieldBlockIdExpression(codeExpr, String(field.id))

    this.expr.withSelfCodeExpression(codeExpr, () => {
      const dependentWhen = field.properties?.dependentWhen

      if (dependentWhen !== undefined) {
        const guardExpr = this.expr.compileOperand(dependentWhen)

        emitter.if(guardExpr, () => {
          this.compileFieldValidationSlot(validWhen, blockIdExpr, blockCodeExpr, emitter)
        })

        return
      }

      this.compileFieldValidationSlot(validWhen, blockIdExpr, blockCodeExpr, emitter)
    })
  }

  /**
   * Registered fields are guarded by dependentWhen before any validWhen checks run,
   * matching the request-time rule that hidden dependent fields should not fail.
   */
  private compileFieldBlock(block: FieldBlockASTNode, emitter: CodeEmitter): void {
    const validWhen = block.properties.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    emitter.comment('StepValidationCompiler.compileFieldBlock')
    emitter.scope(() => {
      const selfCodeExpr = this.fieldCodes.compileRegisteredExpression(block.properties.code, emitter)
      const blockCodeExpr = selfCodeExpr ?? 'undefined'
      const hasDependentWhen =
        block.properties.dependentWhen !== undefined && this.expr.isCompilableNode(block.properties.dependentWhen)

      this.expr.withSelfCodeExpression(selfCodeExpr, () => {
        if (hasDependentWhen) {
          const guardExpr = this.expr.compileExpression(block.properties.dependentWhen!)

          emitter.if(guardExpr, () => {
            this.compileFieldValidationSlot(validWhen, JSON.stringify(block.id), blockCodeExpr, emitter)
          })

          return
        }

        this.compileFieldValidationSlot(validWhen, JSON.stringify(block.id), blockCodeExpr, emitter)
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
    emitter: CodeEmitter,
  ): void {
    emitter.comment('StepValidationCompiler.compileFieldValidationSlot')
    emitter.scope(() => {
      const resultsVar = emitter.let('validationResults')

      this.values.compileValue(value, emitter, resultsVar)
      this.emitValidationResultLoop(resultsVar, 'validation', emitter, (resultVar, messageVar, detailsVar) => {
        emitter.code(
          `errors.push({ blockId: ${blockIdExpr}, blockCode: ${fallbackBlockCodeExpr}, passed: false, message: ${messageVar}, submissionOnly: ${resultVar}.submissionOnly === true, details: ${detailsVar} });`,
        )
      })
    })
  }

  /**
   * Emits evaluation of step-level domain validations into the domain failure list.
   */
  private compileDomainValidationSlot(value: unknown, emitter: CodeEmitter): void {
    if (!hasConfiguredValue(value)) {
      return
    }

    emitter.comment('StepValidationCompiler.compileDomainValidationSlot')
    emitter.scope(() => {
      const resultsVar = emitter.let('domainValidationResults')

      this.values.compileValue(value, emitter, resultsVar)
      this.emitValidationResultLoop(resultsVar, 'domainValidation', emitter, (resultVar, messageVar, detailsVar) => {
        emitter.code(
          `domainErrors.push({ passed: false, message: ${messageVar}, submissionOnly: ${resultVar}.submissionOnly === true, details: ${detailsVar} });`,
        )
      })
    })
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

      emitter.if(`${resultVar}.submissionOnly === true && !isSubmission`, () => emitter.continue())

      emitter.if(`!validationGroupsActive(${resultVar}.groups)`, () => emitter.continue())

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

  /**
   * Finds template field nodes that need validation code emitted inside iterator loops.
   */
  private findTemplateFieldsWithValidation(template: TemplateValue): TemplateNode[] {
    return this.templates.findTemplateNodes(
      template,
      node => isTemplateFieldNode(node) && hasConfiguredValue(node.properties?.validWhen),
    )
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
