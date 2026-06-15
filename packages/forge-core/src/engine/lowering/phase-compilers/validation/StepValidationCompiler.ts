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
import type { ASTNode, TemplateNodeId } from '../../../contracts/ast/ast.type'
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
  CompiledMaterialisedFieldValidationFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type {
  EntryValidationPlan,
  CompiledEntryValidationRule,
  CompiledFieldValidation,
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
   * A step with no entry-validation clauses yields an empty plan, which selects
   * no groups.
   */
  compileEntryValidationPlan(entries: readonly StepEntryValidationAST[] | undefined): EntryValidationPlan {
    const rules: CompiledEntryValidationRule[] = (entries ?? []).map(entry => ({
      nodeId: entry.id,
      groups: entry.groups,
      evaluate: entry.when === true ? undefined : this.compileEntryValidationRule(entry.when),
    }))

    return { entryValidationRules: rules }
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
    const emitter = CodeEmitter.strict()
    emitter.comment('StepValidationCompiler.buildEntryValidationRuleSource')

    const predicateExpr = this.expr.compileExpression(when)

    emitter.return(`Boolean(${predicateExpr})`)

    return emitter.toString()
  }

  /**
   * Assembles the step's {@link ValidationPlan}: one compiled validation function per
   * non-iterator field that declares `validWhen`, plus an optional step-level domain
   * validation function. Materialised field validations are compiled separately via
   * {@link compileMaterialisedValidationFunctions} and bound into closures at
   * materialisation time. Fields without configured validation contribute nothing;
   * a step where nothing validates yields an empty plan, which trivially passes.
   */
  compileValidationPlan(fieldBlocks: readonly FieldBlockASTNode[], domainValidWhen: unknown): ValidationPlan {
    const fields: CompiledFieldValidation[] = []

    for (const block of fieldBlocks) {
      if (!hasConfiguredValue(block.properties.validWhen)) {
        continue
      }

      fields.push({
        nodeId: block.id,
        validate: this.compileFieldValidation(block),
      })
    }

    const domain = this.compileDomainValidation(domainValidWhen)

    return { fieldValidations: fields, domain }
  }

  /**
   * Compiles materialised validation functions for the given iterate nodes.
   * Returns a map keyed by TemplateNodeId containing the compiled validation
   * function for each template field found in the iterate nodes' yield templates.
   */
  compileMaterialisedValidationFunctions(
    iterateNodes: IterateASTNode[],
  ): Map<TemplateNodeId, { nodeId: TemplateNodeId; validate: CompiledMaterialisedFieldValidationFunction }> {
    const entries = new Map<
      TemplateNodeId,
      { nodeId: TemplateNodeId; validate: CompiledMaterialisedFieldValidationFunction }
    >()

    for (const iterateNode of iterateNodes) {
      const template = iterateNode.properties.iterator.yieldTemplate

      if (template === undefined) {
        continue
      }

      this.collectMaterialisedValidations(template, entries, 1)
    }

    return entries
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
    const emitter = CodeEmitter.strict()
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
    const emitter = CodeEmitter.strict()
    emitter.comment('StepValidationCompiler.buildDomainValidationSource')
    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)
    emitter.declareConst('domainErrors', '[]')
    this.compileDomainValidationSlot(domainValidWhen, emitter)
    emitter.emitBlank()
    emitter.return('domainErrors')

    return emitter.toString()
  }

  private collectMaterialisedValidations(
    template: TemplateValue,
    entries: Map<TemplateNodeId, { nodeId: TemplateNodeId; validate: CompiledMaterialisedFieldValidationFunction }>,
    depth: number,
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node =>
        (isTemplateFieldNode(node) && hasConfiguredValue(node.properties?.validWhen)) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateFieldNode(node)) {
        entries.set(node.id as TemplateNodeId, {
          nodeId: node.id as TemplateNodeId,
          validate: this.compileMaterialisedFieldValidation(node, depth),
        })

        return
      }

      const yieldTemplate = this.templates.getMapIterateYieldTemplate(node)

      if (yieldTemplate !== undefined) {
        this.collectMaterialisedValidations(yieldTemplate, entries, depth + 1)
      }
    })
  }

  private compileMaterialisedFieldValidation(
    field: TemplateNode,
    nestingDepth: number,
  ): CompiledMaterialisedFieldValidationFunction {
    return compileGeneratedFunction<CompiledMaterialisedFieldValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups', 'scopeStack'],
      () => this.buildMaterialisedFieldValidationSource(field, nestingDepth),
      { phase: 'field-validation' },
    )
  }

  private buildMaterialisedFieldValidationSource(field: TemplateNode, nestingDepth: number): string {
    const emitter = CodeEmitter.strict()

    this.compileActiveGroups(emitter)
    this.compileValidationRuntimeHelpers(emitter)
    emitter.declareConst('errors', '[]')

    const pushFramesAndEmit = (level: number): void => {
      if (level < 0) {
        const codeExpr = this.templates.compileTemplateCodeExpression(field, emitter)

        this.compileTemplateFieldValidations(field, codeExpr, emitter)

        return
      }

      const frame: IteratorScopeFrame = {
        itemVar: `scopeStack[${level}].item`,
        indexVar: `scopeStack[${level}].index`,
        inputLengthExpr: `scopeStack[${level}].inputLength`,
        rawItemExpr: `scopeStack[${level}].rawItem`,
      }

      this.expr.withIteratorFrame(frame, () => pushFramesAndEmit(level - 1))
    }

    pushFramesAndEmit(nestingDepth - 1)

    emitter.emitBlank()
    emitter.return('errors')

    return emitter.toString()
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
