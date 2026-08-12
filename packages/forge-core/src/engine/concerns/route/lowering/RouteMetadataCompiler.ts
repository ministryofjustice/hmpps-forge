import CodeEmitter from '../../../compilation/lowering/emitters/CodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import type { CompiledRouteMetadataFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { RouteMetadataCompilationInputs } from '../../../contracts/plans/compilationPlan.type'

/**
 * Compiles the package-level route-metadata function for the route-tree phase.
 *
 * Authoring lets title/description/metadata be expressions, so they cannot be
 * baked onto the route tree built once at mount. This compiler lowers every
 * step's and journey's metadata into one generated function that, given a request
 * context, returns the resolved metadata keyed by node ID. The route-tree runtime
 * phase calls it and merges the result onto the static topology.
 *
 * Unlike per-step phase compilers it is compiled once at package scope (the route
 * tree spans every node), then fanned onto every compiled step and journey.
 */
export default class RouteMetadataCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly values: RuntimeValueCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.values = new RuntimeValueCompiler(this.expr, {
      expressionErrorFallback: 'undefined',
      expressionErrorMode: 'throw',
      omitUndefinedArrayItems: false,
    })
  }

  /**
   * Compiles the collected route-metadata inputs into one evaluator.
   *
   * The generated function returns resolved metadata keyed by node ID. Whether it
   * is sync or async depends on whether any metadata expression calls a registered
   * async function.
   */
  compile(inputs: Iterable<RouteMetadataCompilationInputs>): CompiledRouteMetadataFunction {
    return compileGeneratedFunction<CompiledRouteMetadataFunction>(this.expr, ['ctx'], () => this.buildSource(inputs), {
      phase: 'route-tree',
    })
  }

  /**
   * Builds inspectable generated source without constructing a Function.
   */
  generateSource(inputs: Iterable<RouteMetadataCompilationInputs>): string {
    return buildGeneratedSource(this.expr, () => this.buildSource(inputs))
  }

  /**
   * Emits `result[nodeId] = { title, description?, metadata? }` for every node.
   */
  private buildSource(inputs: Iterable<RouteMetadataCompilationInputs>): string {
    const emitter = new CodeEmitter()
    const entries = [...inputs]

    emitter.code('"use strict";')
    emitter.comment('RouteMetadataCompiler.buildSource')
    emitter.declareConst('result', '{}')
    entries.forEach(input => this.compileEntry(input, emitter))
    emitter.return('result')

    return emitter.toString()
  }

  /**
   * Emits the resolved metadata object for one node.
   */
  private compileEntry(input: RouteMetadataCompilationInputs, emitter: CodeEmitter): void {
    emitter.comment('RouteMetadataCompiler.compileEntry')
    emitter.scope(() => {
      const entryVar = emitter.const('routeMetadataEntry', '{}')

      this.values.compileAssignment(input.title, emitter, entryVar, 'title')

      if (input.description !== undefined) {
        this.values.compileAssignment(input.description, emitter, entryVar, 'description')
      }

      if (input.metadata !== undefined) {
        this.values.compileAssignment(input.metadata, emitter, entryVar, 'metadata')
      }

      emitter.assign(`result[${JSON.stringify(input.nodeId)}]`, entryVar)
    })
  }
}
