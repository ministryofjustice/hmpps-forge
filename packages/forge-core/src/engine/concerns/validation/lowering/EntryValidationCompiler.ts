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
import CodeEmitter from '../../../compilation/codegen/CodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
  deriveScriptLabel,
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
  compileOnEntryValidation(entries: StepEntryValidationAST[] | undefined): CompiledEntryValidationFunction {
    const whenNodes = (entries ?? []).map(entry => entry.when).filter(when => typeof when === 'object')

    return compileGeneratedFunction<CompiledEntryValidationFunction>(
      this.expr,
      ['ctx'],
      () => this.buildEntryValidationSource(entries ?? []),
      { phase: 'entry-validation', label: deriveScriptLabel(whenNodes) },
    )
  }

  /**
   * Produces inspectable entry-validation source for tests and local debugging.
   */
  generateOnEntryValidationSource(entries: StepEntryValidationAST[]): string {
    return buildGeneratedSource(this.expr, () => this.buildEntryValidationSource(entries)).toString()
  }

  /**
   * Emits the entry-validation group selector used by GET rendering.
   */
  private buildEntryValidationSource(entries: StepEntryValidationAST[]): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    emitter.comment('EntryValidationCompiler.buildEntryValidationSource')
    emitter.declareConst('groups', '[]')
    emitter.declareConst('seen', 'Object.create(null)')
    this.compileEntryValidationGroupAccumulator(emitter)

    entries.forEach(entry => this.compileEntryValidationRule(entry, emitter))
    emitter.return('groups')

    return emitter
  }

  /**
   * Emits a tiny local helper so repeated entry groups keep their first declaration position.
   */
  private compileEntryValidationGroupAccumulator(emitter: CodeEmitter): void {
    emitter.comment('EntryValidationCompiler.compileEntryValidationGroupAccumulator')
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
    emitter.comment('EntryValidationCompiler.compileEntryValidationRule')
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
}
