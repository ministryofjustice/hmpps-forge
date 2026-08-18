/**
 * Compiles the `validateOnEntry` group selector for one step.
 *
 * This phase doesn't run validation itself. The `request.validities` phase has
 * already validated every step in non-submission mode, so the generated function
 * only decides which validation groups to display on the first GET render.
 *
 * Function calls go through the `FunctionRegistry` (the registry of author-
 * provided functions) because authors supply those implementations. The registry
 * knows whether a function is async, so it controls whether the generated source
 * is sync or async; the runtime awaits both.
 *
 * Generated-function construction failures throw `ForgeCompilationError`. There is
 * no secondary entry-validation execution path.
 */
import { StepEntryValidationAST } from '../../../chassis/contracts/ast/structures.type'
import { CodeFragment, code, literal } from '../../../chassis/compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../chassis/compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../chassis/compilation/lowering/codegen/fragments/IdentifierName'
import ExpressionDispatcher from '../../../chassis/compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../chassis/compilation/lowering/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import type { ValidationModel } from '../contracts/validationModel.type'

import type { CompiledEntryValidationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'

/**
 * Compiler for the step-level entry-validation generated function.
 *
 * It builds the source layout that accumulates matching validation groups, and
 * delegates each rule's `when` predicate to the shared expression dispatcher.
 */
export default class EntryValidationCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  /**
   * Builds the generated group-selector used before rendering a GET request.
   */
  compileOnEntryValidation(model: ValidationModel): CompiledEntryValidationFunction {
    return compileGeneratedFunction<CompiledEntryValidationFunction>(
      this.expr,
      ['ctx'],
      () => this.buildEntryValidationSource(model.entryValidation),
      { phase: CompilationPhase.ENTRY_VALIDATION, label: model.label },
    )
  }

  /**
   * Produces inspectable entry-validation source for tests and local debugging.
   */
  generateOnEntryValidationSource(model: ValidationModel): string {
    return renderGeneratedSource(this.expr, () => this.buildEntryValidationSource(model.entryValidation))
  }

  /**
   * Emits the entry-validation group selector used by GET rendering.
   */
  private buildEntryValidationSource(entries: readonly StepEntryValidationAST[]): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    if (entries.length === 0) {
      generator.note('This step declares no validateOnEntry rules, so no groups are selected.')
      generator.return(code`[]`)

      return generator
    }

    const groups = generator.const('groups', code`[]`)
    const seen = generator.const('seen', code`Object.create(null)`)
    const addGroup = this.compileEntryValidationGroupAccumulator(groups, seen, generator)

    entries.forEach(entry => this.compileEntryValidationRule(entry, addGroup, generator))
    generator.return(groups)

    return generator
  }

  /**
   * Emits a tiny local helper so repeated entry groups keep their first declaration position.
   */
  private compileEntryValidationGroupAccumulator(
    groups: IdentifierName,
    seen: IdentifierName,
    generator: CodeGenerator,
  ): IdentifierName {
    generator.comment('Record each matching group once, in first-declared order')

    return generator.function('addGroup', ['group'], (functionGenerator, [group]) => {
      const groupKey = functionGenerator.const('groupKey', code`String(${group})`)

      functionGenerator.if(code`!${seen}[${groupKey}]`, () => {
        functionGenerator.assign(code`${seen}[${groupKey}]`, literal(true))
        functionGenerator.statement(code`${groups}.push(${groupKey})`)
      })
    })
  }

  /**
   * Emits one validateOnEntry rule, preserving unconditional entries as direct group additions.
   */
  private compileEntryValidationRule(
    entry: StepEntryValidationAST,
    addGroup: IdentifierName,
    generator: CodeGenerator,
  ): void {
    generator.comment(`Entry rule — groups ${entry.groups.map(group => `"${group}"`).join(', ')}`)
    generator.scope(() => {
      if (entry.when === true) {
        this.compileEntryValidationGroups(entry.groups, addGroup, generator)

        return
      }

      const when = this.compileEntryValidationWhen(entry.when, generator)

      generator.if(code`${when}`, () => this.compileEntryValidationGroups(entry.groups, addGroup, generator))
    })
  }

  /**
   * Emits a validateOnEntry predicate as a named boolean so generated source reads as a rule guard.
   */
  private compileEntryValidationWhen(
    when: StepEntryValidationAST['when'],
    generator: CodeGenerator,
  ): CodeFragment | IdentifierName {
    if (when === true) {
      return literal(true)
    }

    const predicate = this.expr.compileExpressionCode(when)

    return generator.const('entryWhen', code`Boolean(${predicate})`)
  }

  /**
   * Emits the declared validateOnEntry groups through addGroup to preserve uniqueness and ordering.
   */
  private compileEntryValidationGroups(
    groups: readonly string[],
    addGroup: IdentifierName,
    generator: CodeGenerator,
  ): void {
    groups.forEach(group => {
      generator.statement(code`${addGroup}(${group})`)
    })
  }
}
