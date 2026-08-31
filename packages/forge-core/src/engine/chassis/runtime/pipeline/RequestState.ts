import type { NodeId } from '../../contracts/ast/ast.type'
import type { ReachabilityEvaluation } from '../../../concerns/reachability/contracts/reachabilityEvaluation.type'
import type { ValidationView } from '../../../concerns/validation/contracts/validationView.type'
import type FunctionRegistry from '../../registries/FunctionRegistry'
import type { FunctionRegistryBuilder } from '../../../../authoring/types/functions.type'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import type { ResponseBindings } from '../../../../framework/types/responseBindings.type'
import type { RenderContext } from '../../../../framework/types/rendering.type'
import type { RouteTree } from '../../../../framework/types/routeTree.type'
import type { RequestPipelineResult } from '../../contracts/runtime/requestPipelineOutput.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

export interface RequestStateDependencies {
  readonly responseBindings: ResponseBindings
  readonly functionBuilders: readonly FunctionRegistryBuilder[]
  readonly packageDependencies: unknown
  readonly adapterDependencies?: object
  readonly requestDependencies?: () => object | PromiseLike<object>
  readonly currentStepId?: NodeId
  readonly hasRenderer: boolean
  readonly traceEnabled: boolean
}

/**
 * The state the request phases build up, one phase at a time: reachability
 * records its evaluation, route-tree records the hydrated tree, validation
 * records the current-page view, resolve records the render context, render
 * records the rendered blocks, and the pipeline records its resolved result.
 * A getter throws only where every reader runs after the writer — the
 * first-match pipeline legitimately halts early, so most values stay optional.
 */
export default class RequestState {
  /**
   * Document anchors for failing field blocks, keyed by render block ID.
   * Written during block resolution (each failing field records its `idPrefix`
   * or code) and read back when the resolve phase assembles the render
   * context's field validation errors. The record is handed to compiled
   * resolve contexts by identity and mutated in place.
   */
  readonly fieldFailureAnchors: Record<string, string> = {}

  private mutableReachabilityEvaluation?: ReachabilityEvaluation

  private mutableRouteTree?: RouteTree

  private mutableCurrentPageValidation?: ValidationView

  private mutableRenderContext?: RenderContext

  private mutableResolvedBlockShape?: unknown

  private mutableRenderedBlocks?: readonly unknown[]

  private mutableRenderedBlockShape?: unknown

  private mutablePipelineResult?: RequestPipelineResult

  private mutableFunctionRegistry?: FunctionRegistry

  constructor(
    readonly context: RuntimeContext,
    readonly dependencies: RequestStateDependencies,
  ) {}

  get renderContext(): RenderContext {
    if (this.mutableRenderContext === undefined) {
      throw new ForgeInternalError('Render phase reached without a render context - resolve phase did not produce one')
    }

    return this.mutableRenderContext
  }

  get pipelineResult(): RequestPipelineResult {
    if (this.mutablePipelineResult === undefined) {
      throw new ForgeInternalError('Request pipeline completed without a result')
    }

    return this.mutablePipelineResult
  }

  get functionRegistry(): FunctionRegistry {
    if (this.mutableFunctionRegistry === undefined) {
      throw new ForgeInternalError(
        'Function registry read before request context preparation built the request-owned registry',
      )
    }

    return this.mutableFunctionRegistry
  }

  /** Undefined until reachability has run - journey halts and error traces read it early. */
  get reachabilityEvaluation(): ReachabilityEvaluation | undefined {
    return this.mutableReachabilityEvaluation
  }

  /** Undefined until the route-tree phase has run - earlier halts and error traces read it early. */
  get routeTree(): RouteTree | undefined {
    return this.mutableRouteTree
  }

  /**
   * The result of the current-page validation round, written only by the
   * `validation.current-step` work handler. Its presence is the display signal:
   * present means current-page validation ran and should be surfaced (a present
   * result may be valid and carry no failures); absent means it never ran.
   */
  get currentPageValidation(): ValidationView | undefined {
    return this.mutableCurrentPageValidation
  }

  get renderedBlocks(): readonly unknown[] | undefined {
    return this.mutableRenderedBlocks
  }

  get resolvedBlockShape(): unknown {
    return this.mutableResolvedBlockShape
  }

  get renderedBlockShape(): unknown {
    return this.mutableRenderedBlockShape
  }

  recordReachabilityEvaluation(evaluation: ReachabilityEvaluation): void {
    this.mutableReachabilityEvaluation = evaluation
  }

  recordRouteTree(routeTree: RouteTree): void {
    this.mutableRouteTree = routeTree
  }

  recordCurrentPageValidation(view: ValidationView): void {
    this.mutableCurrentPageValidation = view
  }

  recordRenderContext(renderContext: RenderContext): void {
    this.mutableRenderContext = renderContext
  }

  recordResolvedBlockShape(resolvedBlockShape: unknown): void {
    this.mutableResolvedBlockShape = resolvedBlockShape
  }

  recordRenderedBlocks(renderedBlocks: readonly unknown[]): void {
    this.mutableRenderedBlocks = renderedBlocks
  }

  recordRenderedBlockShape(renderedBlockShape: unknown): void {
    this.mutableRenderedBlockShape = renderedBlockShape
  }

  recordPipelineResult(result: RequestPipelineResult): void {
    this.mutablePipelineResult = result
  }

  recordFunctionRegistry(functionRegistry: FunctionRegistry): void {
    this.mutableFunctionRegistry = functionRegistry
  }
}
