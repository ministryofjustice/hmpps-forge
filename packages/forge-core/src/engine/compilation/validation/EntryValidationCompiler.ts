import FunctionRegistry from '../../registries/FunctionRegistry'
import { ASTNode } from '../../types/ast.type'
import { StepEntryValidationAST } from '../../types/structures.type'
import CodeEmitter from '../codegen/CodeEmitter'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import NodeCompilationDispatcher from '../codegen/NodeCompilationDispatcher'
import { ValidationContext } from './StepValidationCompiler'

export type CompiledEntryValidationFunction = (ctx: ValidationContext) => string[] | Promise<string[]>

export default class EntryValidationCompiler {
  private readonly expr = new NodeCompilationDispatcher()

  compile(
    entries: StepEntryValidationAST[] | undefined,
    functionRegistry: FunctionRegistry,
  ): CompiledEntryValidationFunction | undefined {
    if (entries === undefined || entries.length === 0) {
      return undefined
    }

    return compileGeneratedFunction<CompiledEntryValidationFunction>(
      this.expr,
      ['ctx'],
      functionRegistry,
      () => this.buildSource(entries),
      { phase: 'entry-validation' },
    )
  }

  generateSource(entries: StepEntryValidationAST[], functionRegistry?: FunctionRegistry): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildSource(entries))
  }

  private buildSource(entries: StepEntryValidationAST[]): string {
    const emitter = new CodeEmitter()

    emitter.emit('"use strict";')
    emitter.emit('var groups = [];')
    emitter.emit('var seen = Object.create(null);')
    emitter.emit(
      'var addGroup = function(group) { var key = String(group); if (!seen[key]) { seen[key] = true; groups.push(key); } };',
    )
    emitter.emitBlank()

    entries.forEach(entry => {
      const predicateVar = this.compileWhen(entry.when, emitter)

      emitter.emitBlock(`if (${predicateVar})`, () => {
        entry.groups.forEach(group => {
          emitter.emit(`addGroup(${JSON.stringify(group)});`)
        })
      })
      emitter.emitBlank()
    })

    emitter.emit('return groups;')

    return emitter.toString()
  }

  private compileWhen(when: true | ASTNode, emitter: CodeEmitter): string {
    if (when === true) {
      const literalVar = emitter.nextVar('_entryWhen')

      emitter.emit(`var ${literalVar} = true;`)

      return literalVar
    }

    const predicateVar = emitter.nextVar('_entryWhen')
    const predicateExpr = this.expr.compileExpression(when)

    emitter.emit(`var ${predicateVar};`)
    emitter.emit(`${predicateVar} = !!(${predicateExpr});`)

    return predicateVar
  }
}
