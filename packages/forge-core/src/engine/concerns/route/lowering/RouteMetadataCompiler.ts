import {
  code,
  literal,
  objectCode,
  ObjectCodeProperty,
} from '../../../chassis/compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../chassis/compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../chassis/compilation/lowering/codegen/fragments/IdentifierName'
import ExpressionDispatcher from '../../../chassis/compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../chassis/compilation/lowering/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../chassis/compilation/lowering/structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import type { CompiledRouteMetadataFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
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
   * Emits `routeMetadata[nodeId] = { title, description?, metadata? }` for every node.
   */
  private buildSource(inputs: Iterable<RouteMetadataModel>): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])
    const entries = [...inputs]

    generator.directive('use strict')
    generator.comment('Resolved route metadata, keyed by node id')
    const routeMetadata = generator.const('routeMetadata', code`{}`)

    entries.forEach(input => this.compileEntry(input, routeMetadata, generator))
    generator.return(routeMetadata)

    return generator
  }

  /**
   * Emits the resolved metadata object for one node. Static values sit inline
   * in the literal; expression-backed values hoist into named consts just above.
   */
  private compileEntry(input: RouteMetadataModel, routeMetadata: IdentifierName, generator: CodeGenerator): void {
    const properties: ObjectCodeProperty[] = [
      { key: 'title', value: this.values.compileValueExpression(input.title, generator, 'title') },
    ]

    if (input.description !== undefined) {
      properties.push({
        key: 'description',
        value: this.values.compileValueExpression(input.description, generator, 'description'),
      })
    }

    if (input.metadata !== undefined) {
      properties.push({
        key: 'metadata',
        value: this.values.compileValueExpression(input.metadata, generator, 'metadata'),
      })
    }

    generator.assign(code`${routeMetadata}[${input.nodeId}]`, objectCode(properties))
  }
}
