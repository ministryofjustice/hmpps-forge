/**
 * Compiles the validateOnEntry group selector for one step.
 *
 * This phase computes no validation of its own. `request.validities` has already
 * run every validating step in non-submission mode, so the generated function
 * only decides which validation groups the first render should show.
 *
 * Function calls stay indirect through FunctionRegistry because journey authors
 * provide those implementations. Registry metadata decides whether generated
 * source remains sync or becomes async; the runtime awaits both shapes.
 *
 * Generated-function construction failures throw ForgeCompilationError. There is
 * no secondary entry-validation execution path.
 */
import { StepEntryValidationAST } from '../../../contracts/ast/structures.type'
import { Code, code, literal } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  compileGeneratedFunction,
  deriveScriptLabel,
  renderGeneratedSource,
  ScriptLabelSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'

import type { CompiledEntryValidationFunction } from '../../../contracts/compiled/compiledFunctions.type'

/**
 * Phase compiler for the step-level entry-validation generated function.
 *
 * It owns the group-accumulator source layout while delegating each rule's `when`
 * predicate to the shared expression compiler.
 */
export default class EntryValidationCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  /**
   * Builds the generated group-selector used before rendering a GET request.
   */
  compileOnEntryValidation(
    stepNode: ScriptLabelSource | undefined,
    entries: StepEntryValidationAST[] | undefined,
  ): CompiledEntryValidationFunction {
    return compileGeneratedFunction<CompiledEntryValidationFunction>(
      this.expr,
      ['ctx'],
      () => this.buildEntryValidationSource(entries ?? []),
      { phase: 'entry-validation', label: deriveScriptLabel([stepNode]) },
    )
  }

  /**
   * Produces inspectable entry-validation source for tests and local debugging.
   */
  generateOnEntryValidationSource(entries: StepEntryValidationAST[]): string {
    return renderGeneratedSource(this.expr, () => this.buildEntryValidationSource(entries))
  }

  /**
   * Emits the entry-validation group selector used by GET rendering.
   */
  private buildEntryValidationSource(entries: StepEntryValidationAST[]): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    generator.comment('EntryValidationCompiler.buildEntryValidationSource')
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
  private compileEntryValidationGroupAccumulator(groups: Name, seen: Name, generator: CodeGenerator): Name {
    generator.comment('EntryValidationCompiler.compileEntryValidationGroupAccumulator')

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
  private compileEntryValidationRule(entry: StepEntryValidationAST, addGroup: Name, generator: CodeGenerator): void {
    generator.comment('EntryValidationCompiler.compileEntryValidationRule')
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
  private compileEntryValidationWhen(when: StepEntryValidationAST['when'], generator: CodeGenerator): Code | Name {
    if (when === true) {
      return literal(true)
    }

    const predicate = this.expr.compileExpressionCode(when)

    return generator.const('entryWhen', code`Boolean(${predicate})`)
  }

  /**
   * Emits the declared validateOnEntry groups through addGroup to preserve uniqueness and ordering.
   */
  private compileEntryValidationGroups(groups: readonly string[], addGroup: Name, generator: CodeGenerator): void {
    groups.forEach(group => {
      generator.statement(code`${addGroup}(${group})`)
    })
  }
}
