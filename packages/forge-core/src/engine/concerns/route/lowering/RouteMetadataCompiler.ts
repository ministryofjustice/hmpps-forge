import { code, literal } from '../../../compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../compilation/lowering/codegen/fragments/IdentifierName'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../compilation/lowering/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import type { CompiledRouteMetadataFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { RouteMetadataModel } from '../contracts/routeMetadataModel.type'

/**
 * Compiles the package-level route-metadata function for the route-tree phase.
 *
 * Journey authors can set title, description, and metadata as expressions, so
 * their values can't be fixed on the route tree at mount time. This compiler
 * turns every step's and journey's metadata into one generated function that
 * evaluates them at request time and returns the results keyed by node ID. The
 * route-tree runtime phase calls it and merges the result onto the static
 * route topology.
 *
 * Unlike per-step compilers this is compiled once at package scope (the route
 * tree spans every node), then shared across every compiled step and journey.
 */
export default class RouteMetadataCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly values: RuntimeValueCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.values = new RuntimeValueCompiler(this.expr, {
      expressionErrorFallback: literal(undefined),
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
  compile(inputs: Iterable<RouteMetadataModel>): CompiledRouteMetadataFunction {
    return compileGeneratedFunction<CompiledRouteMetadataFunction>(this.expr, ['ctx'], () => this.buildSource(inputs), {
      phase: CompilationPhase.ROUTE_TREE,
    })
  }

  /**
   * Builds inspectable generated source without constructing a Function.
   */
  generateSource(inputs: Iterable<RouteMetadataModel>): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(inputs))
  }

  /**
   * Emits `result[nodeId] = { title, description?, metadata? }` for every node.
   */
  private buildSource(inputs: Iterable<RouteMetadataModel>): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])
    const entries = [...inputs]

    generator.directive('use strict')
    generator.comment('RouteMetadataCompiler.buildSource')
    const result = generator.const('result', code`{}`)

    entries.forEach(input => this.compileEntry(input, result, generator))
    generator.return(result)

    return generator
  }

  /**
   * Emits the resolved metadata object for one node.
   */
  private compileEntry(input: RouteMetadataModel, result: IdentifierName, generator: CodeGenerator): void {
    generator.comment('RouteMetadataCompiler.compileEntry')
    generator.scope(() => {
      const entry = generator.const('routeMetadataEntry', code`{}`)

      this.values.compileAssignment(input.title, generator, entry, 'title')

      if (input.description !== undefined) {
        this.values.compileAssignment(input.description, generator, entry, 'description')
      }

      if (input.metadata !== undefined) {
        this.values.compileAssignment(input.metadata, generator, entry, 'metadata')
      }

      generator.assign(code`${result}[${input.nodeId}]`, entry)
    })
  }
}
