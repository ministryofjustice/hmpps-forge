/**
 * Compiles validation functions for one step.
 *
 * The primary output is a {@link ValidationPlan}: per-field and per-iterate
 * compiled functions plus an optional domain validation function. The runtime
 * orchestrator walks the plan, calling each entry independently and collecting
 * failures into a {@link StepValidityResult}.
 *
 * On-entry validation is a small group selector for `validateOnEntry`.
 *
 * Function calls stay indirect through FunctionRegistry because journey authors
 * provide those implementations. Registry metadata decides whether generated
 * source remains sync or becomes async.
 */
import type { ASTNode } from '../../../contracts/ast/ast.type'
import { FieldBlockASTNode, StepEntryValidationAST } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import CodeEmitter from '../../emitters/CodeEmitter'
import FieldCodeEmitter from '../../emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import { compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, {
  isTemplateFieldNode,
  isTemplateIterateNode,
} from '../../structures/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../../structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'

import type {
  CompiledDomainValidationFunction,
  CompiledEntryValidationRuleFunction,
  CompiledFieldValidationFunction,
  CompiledIteratorFieldValidationFunction,
  CompiledIteratorInputFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type {
  EntryValidationPlan,
  EntryValidationRule,
  FieldValidationEntry,
  IteratorFieldValidationEntry,
  IteratorValidationGroup,
  ValidationPlan,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { IteratorScopeFrame } from '../../expressions/ExpressionDispatcher'

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

  compileEntryValidationPlan(entries: StepEntryValidationAST[] | undefined): EntryValidationPlan | undefined {
    if (entries === undefined || entries.length === 0) {
      return undefined
    }

    const rules: EntryValidationRule[] = entries.map(entry => ({
      groups: entry.groups,
      evaluate: entry.when === true ? undefined : this.compileSingleEntryValidationRule(entry.when),
    }))

    return { rules }
  }

  private compileSingleEntryValidationRule(when: ASTNode): CompiledEntryValidationRuleFunction {
    return compileGeneratedFunction<CompiledEntryValidationRuleFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSingleEntryValidationRuleSource(when),
      { phase: 'entry-validation' },
    )
  }

  private buildSingleEntryValidationRuleSource(when: ASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildSingleEntryValidationRuleSource')

    const predicateExpr = this.expr.compileExpression(when)

    emitter.return(`Boolean(${predicateExpr})`)

    return emitter.toString()
  }

  compileValidationPlan(
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
  ): ValidationPlan | undefined {
    const fields: FieldValidationEntry[] = []

    for (const block of fieldBlocks) {
      if (!hasConfiguredValue(block.properties.validWhen)) {
        continue
      }

      fields.push({
        validate: this.compileSingleFieldValidation(block),
      })
    }

    const iteratorGroups: IteratorValidationGroup[] = []

    for (const iterateNode of iterateNodes) {
      const group = this.compileIteratorGroup(iterateNode)

      if (group !== undefined) {
        iteratorGroups.push(group)
      }
    }

    const domain = this.compileSingleDomainValidation(domainValidWhen)

    if (fields.length === 0 && iteratorGroups.length === 0 && domain === undefined) {
      return undefined
    }

    return { fields, iteratorGroups, domain }
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

  private compileSingleFieldValidation(block: FieldBlockASTNode): CompiledFieldValidationFunction {
    return compileGeneratedFunction<CompiledFieldValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups'],
      () => this.buildSingleFieldValidationSource(block),
      { phase: 'field-validation' },
    )
  }

  private buildSingleFieldValidationSource(block: FieldBlockASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildSingleFieldValidationSource')
    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)
    emitter.declareConst('errors', '[]')
    this.compileFieldBlock(block, emitter)
    emitter.emitBlank()
    emitter.return('errors')

    return emitter.toString()
  }

  private compileSingleDomainValidation(domainValidWhen: unknown): CompiledDomainValidationFunction | undefined {
    if (!hasConfiguredValue(domainValidWhen)) {
      return undefined
    }

    return compileGeneratedFunction<CompiledDomainValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups'],
      () => this.buildSingleDomainValidationSource(domainValidWhen),
      { phase: 'domain-validation' },
    )
  }

  private buildSingleDomainValidationSource(domainValidWhen: unknown): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildSingleDomainValidationSource')
    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)
    emitter.declareConst('domainErrors', '[]')
    this.compileDomainValidationSlot(domainValidWhen, emitter)
    emitter.emitBlank()
    emitter.return('domainErrors')

    return emitter.toString()
  }

  private compileIteratorGroup(iterateNode: IterateASTNode): IteratorValidationGroup | undefined {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined) {
      return undefined
    }

    const fields: IteratorFieldValidationEntry[] = []

    this.collectLeafValidationFields(template, fields, [])

    if (fields.length === 0) {
      return undefined
    }

    const evaluateInput = this.compileIteratorInputEvaluator(iterateNode)

    return { evaluateInput, fields }
  }

  private collectLeafValidationFields(
    template: TemplateValue,
    entries: IteratorFieldValidationEntry[],
    ancestorIterates: readonly TemplateNode[],
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node =>
        (isTemplateFieldNode(node) && hasConfiguredValue(node.properties?.validWhen)) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateFieldNode(node)) {
        entries.push({
          validate: this.compileIteratorFieldValidation(node, ancestorIterates),
        })

        return
      }

      const yieldTemplate = this.templates.getMapIterateYieldTemplate(node)

      if (yieldTemplate !== undefined) {
        this.collectLeafValidationFields(yieldTemplate, entries, [...ancestorIterates, node])
      }
    })
  }

  private compileIteratorInputEvaluator(iterateNode: IterateASTNode): CompiledIteratorInputFunction {
    return compileGeneratedFunction<CompiledIteratorInputFunction>(
      this.expr,
      ['ctx'],
      () => this.buildIteratorInputEvaluatorSource(iterateNode),
      { phase: 'iterator-input' },
    )
  }

  private buildIteratorInputEvaluatorSource(iterateNode: IterateASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildIteratorInputEvaluatorSource')

    const inputVar = emitter.let('iteratorInput', this.expr.compileOperand(iterateNode.properties.input))

    this.templates.compileNormalizeIteratorInput(inputVar, emitter)

    emitter.declareConst('result', '[]')
    emitter.if(`Array.isArray(${inputVar})`, () => {
      const indexVar = emitter.let('i', '0')

      emitter.while(`${indexVar} < ${inputVar}.length`, () => {
        const rawItemVar = emitter.const('rawItem', `${inputVar}[${indexVar}]`)

        emitter.assign(indexVar, `${indexVar} + 1`)
        emitter.if(`${rawItemVar} == null`, () => emitter.continue())

        const itemVar = emitter.const('item', this.templates.compileIteratorItemScope(rawItemVar))

        emitter.code(
          `result.push({ item: ${itemVar}, index: ${indexVar} - 1, rawItem: ${rawItemVar}, inputLength: ${inputVar}.length });`,
        )
      })
    })
    emitter.emitBlank()
    emitter.return('result')

    return emitter.toString()
  }

  private compileIteratorFieldValidation(
    field: TemplateNode,
    ancestorIterates: readonly TemplateNode[],
  ): CompiledIteratorFieldValidationFunction {
    return compileGeneratedFunction<CompiledIteratorFieldValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups', 'iteratorScope'],
      () => this.buildIteratorFieldValidationSource(field, ancestorIterates),
      { phase: 'field-validation' },
    )
  }

  private buildIteratorFieldValidationSource(field: TemplateNode, ancestorIterates: readonly TemplateNode[]): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildIteratorFieldValidationSource')
    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)
    emitter.declareConst('errors', '[]')

    const outerFrame: IteratorScopeFrame = {
      itemVar: 'iteratorScope.item',
      indexVar: 'iteratorScope.index',
      inputLengthExpr: 'iteratorScope.inputLength',
      rawItemExpr: 'iteratorScope.rawItem',
    }

    this.expr.withIteratorFrame(outerFrame, () => {
      this.emitNestedLoopsAndCompileValidation(field, ancestorIterates, 0, emitter)
    })

    emitter.emitBlank()
    emitter.return('errors')

    return emitter.toString()
  }

  private emitNestedLoopsAndCompileValidation(
    field: TemplateNode,
    ancestorIterates: readonly TemplateNode[],
    depth: number,
    emitter: CodeEmitter,
  ): void {
    if (depth >= ancestorIterates.length) {
      const codeExpr = this.templates.compileTemplateCodeExpression(field, emitter)

      this.compileTemplateFieldValidations(field, codeExpr, emitter)

      return
    }

    this.templates.compileTemplateMapIterator(ancestorIterates[depth], emitter, () => {
      this.emitNestedLoopsAndCompileValidation(field, ancestorIterates, depth + 1, emitter)
    })
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
