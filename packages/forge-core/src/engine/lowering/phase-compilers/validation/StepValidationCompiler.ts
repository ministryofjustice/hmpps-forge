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
 * provide those implementations. A generated function is sync unless an awaited
 * call is reached while compiling its body, at which point the whole function
 * becomes async.
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

  /**
   * Builds the on-GET-entry group selector: one rule per authored `validateOnEntry`
   * clause, each carrying the validation groups to run plus a compiled `when` predicate.
   * A `when` of literal `true` yields no predicate (the groups run unconditionally).
   * Returns undefined when there are no entry-validation clauses.
   */
  compileEntryValidationPlan(entries: StepEntryValidationAST[] | undefined): EntryValidationPlan | undefined {
    if (entries === undefined || entries.length === 0) {
      return undefined
    }

    const rules: EntryValidationRule[] = entries.map(entry => ({
      nodeId: entry.id,
      groups: entry.groups,
      evaluate: entry.when === true ? undefined : this.compileEntryValidationRule(entry.when),
    }))

    return { rules }
  }

  /**
   * Compiles one entry-validation `when` predicate into a boolean-returning function over `ctx`.
   */
  private compileEntryValidationRule(when: ASTNode): CompiledEntryValidationRuleFunction {
    return compileGeneratedFunction<CompiledEntryValidationRuleFunction>(
      this.expr,
      ['ctx'],
      () => this.buildEntryValidationRuleSource(when),
      { phase: 'entry-validation' },
    )
  }

  /**
   * Emits the source for an entry-validation predicate, coercing the result to a strict boolean.
   */
  private buildEntryValidationRuleSource(when: ASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildEntryValidationRuleSource')

    const predicateExpr = this.expr.compileExpression(when)

    emitter.return(`Boolean(${predicateExpr})`)

    return emitter.toString()
  }

  /**
   * Assembles the step's {@link ValidationPlan}: one compiled validation function per
   * field that declares `validWhen`, one iterator group per MAP iterate node, and an
   * optional step-level domain validation function. Fields and iterate nodes without
   * configured validation contribute nothing. Returns undefined when nothing validates.
   */
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
        nodeId: block.id,
        validate: this.compileFieldValidation(block),
      })
    }

    const iteratorGroups: IteratorValidationGroup[] = []

    for (const iterateNode of iterateNodes) {
      const group = this.compileIteratorGroup(iterateNode)

      if (group !== undefined) {
        iteratorGroups.push(group)
      }
    }

    const domain = this.compileDomainValidation(domainValidWhen)

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

  /**
   * Compiles one field's `validWhen` into a function returning that field's
   * {@link StepValidationFailure} list (empty when the field passes or is gated out
   * by `dependentWhen`). The function is async iff any awaited registry call is reached.
   */
  private compileFieldValidation(block: FieldBlockASTNode): CompiledFieldValidationFunction {
    return compileGeneratedFunction<CompiledFieldValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups'],
      () => this.buildFieldValidationSource(block),
      { phase: 'field-validation' },
    )
  }

  /**
   * Emits the field-validation function body: resolve the caller's active groups, declare
   * the group helpers and `errors` accumulator, run the field's slot, then return `errors`.
   */
  private buildFieldValidationSource(block: FieldBlockASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildFieldValidationSource')
    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)
    emitter.declareConst('errors', '[]')
    this.compileFieldBlock(block, emitter)
    emitter.emitBlank()
    emitter.return('errors')

    return emitter.toString()
  }

  /**
   * Compiles the step's domain `validWhen` into a function returning its
   * {@link DomainValidationFailure} list. Returns undefined when no domain validation
   * is configured, so the plan omits a `domain` entry entirely.
   */
  private compileDomainValidation(domainValidWhen: unknown): CompiledDomainValidationFunction | undefined {
    if (!hasConfiguredValue(domainValidWhen)) {
      return undefined
    }

    return compileGeneratedFunction<CompiledDomainValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups'],
      () => this.buildDomainValidationSource(domainValidWhen),
      { phase: 'domain-validation' },
    )
  }

  /**
   * Emits the domain-validation function body, accumulating failures into `domainErrors`.
   */
  private buildDomainValidationSource(domainValidWhen: unknown): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepValidationCompiler.buildDomainValidationSource')
    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)
    emitter.declareConst('domainErrors', '[]')
    this.compileDomainValidationSlot(domainValidWhen, emitter)
    emitter.emitBlank()
    emitter.return('domainErrors')

    return emitter.toString()
  }

  /**
   * Builds one {@link IteratorValidationGroup} for a MAP iterate node: an `evaluateInput`
   * function that expands the collection into per-item scopes, plus one validation function
   * per leaf field that declares `validWhen`, gathered through any nested iterate levels.
   * Returns undefined when the node has no yield template or no validating leaf fields.
   */
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

    return { nodeId: iterateNode.id, evaluateInput, fields }
  }

  /**
   * Walks the iterator template (without descending into matched nodes), compiling each
   * validating field into an entry and recursing through every nested MAP iterate so that
   * leaf fields at any depth are collected. `ancestorIterates` records the chain of
   * intermediate iterate nodes so the compiled field can re-emit the enclosing loops.
   * Appends to `entries` in place.
   */
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
          nodeId: node.id,
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

  /**
   * Compiles the group's input evaluator: a function producing the {@link IteratorItemScope}
   * array (item, index, rawItem, inputLength) the runtime iterates over.
   */
  private compileIteratorInputEvaluator(iterateNode: IterateASTNode): CompiledIteratorInputFunction {
    return compileGeneratedFunction<CompiledIteratorInputFunction>(
      this.expr,
      ['ctx'],
      () => this.buildIteratorInputEvaluatorSource(iterateNode),
      { phase: 'iterator-input' },
    )
  }

  /**
   * Emits the input-evaluator body: normalize the iterate input, then for each non-null
   * array entry push an item scope (skipping nullish entries). A non-array input yields an
   * empty result.
   */
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

  /**
   * Compiles one leaf iterator field's validation into a function that takes the outer
   * {@link IteratorItemScope} and returns its failures. Any nested iterate levels above
   * the field are re-emitted as inline loops inside the body.
   */
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

  /**
   * Emits the leaf iterator field's body: pushes the outer iterator frame (mapping
   * `@scope`/`@loop` onto `iteratorScope`), then descends through the ancestor iterate
   * chain emitting a loop per level before running the field's validation slot.
   */
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

  /**
   * Recursively emits one map-iterator loop per remaining ancestor level, then at the leaf
   * (depth past the last ancestor) resolves the field's code expression and emits its
   * validation checks within the innermost scope.
   */
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

/**
 * Treats an authored slot as configured when it is present and non-empty: `undefined` and
 * empty arrays count as nothing to validate, while any other value (including a non-empty
 * array) counts as configured.
 */
function hasConfiguredValue(value: unknown): boolean {
  if (value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}
