import { code, literal } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  compileGeneratedFunction,
  renderGeneratedSource,
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
  compile(inputs: Iterable<RouteMetadataCompilationInputs>): CompiledRouteMetadataFunction {
    return compileGeneratedFunction<CompiledRouteMetadataFunction>(this.expr, ['ctx'], () => this.buildSource(inputs), {
      phase: 'route-tree',
    })
  }

  /**
   * Builds inspectable generated source without constructing a Function.
   */
  generateSource(inputs: Iterable<RouteMetadataCompilationInputs>): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(inputs))
  }

  /**
   * Emits `result[nodeId] = { title, description?, metadata? }` for every node.
   */
  private buildSource(inputs: Iterable<RouteMetadataCompilationInputs>): CodeGenerator {
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
  private compileEntry(input: RouteMetadataCompilationInputs, result: Name, generator: CodeGenerator): void {
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
