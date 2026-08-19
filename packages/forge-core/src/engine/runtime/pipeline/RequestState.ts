import type { NodeId } from '../../contracts/ast/ast.type'
import type { ReachabilityEvaluation } from '../../concerns/reachability/contracts/reachabilityEvaluation.type'
import type { ValidationView } from '../../concerns/validation/contracts/validationView.type'
import type FunctionRegistry from '../../registries/FunctionRegistry'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { ComponentRegistry } from '../../../framework/types/adapter.type'
import type { RenderContext } from '../../../framework/types/rendering.type'
import type { RouteTree } from '../../../framework/types/routeTree.type'
import type { RequestPipelineResult } from '../../contracts/runtime/requestPipelineOutput.type'
import type {
  StepValidationWorkTask,
  ValidationRuleFilter,
} from '../../concerns/validation/contracts/ValidationWork.type'
import ForgeInternalError from '../../errors/ForgeInternalError'

type StepValidationTaskResult = StepValidationWorkTask | undefined

export interface RequestDependencies {
  readonly responseBindings: ResponseBindings
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly currentStepId?: NodeId
  readonly hasRenderer: boolean
  readonly traceEnabled: boolean
  readonly buildStepValidation: (
    stepId: NodeId,
    filter: ValidationRuleFilter,
  ) => StepValidationTaskResult | Promise<StepValidationTaskResult>
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

  private mutableRenderedBlocks?: readonly unknown[]

  private mutablePipelineResult?: RequestPipelineResult

  constructor(
    readonly context: RuntimeContext,
    readonly dependencies: RequestDependencies,
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

  recordRenderedBlocks(renderedBlocks: readonly unknown[]): void {
    this.mutableRenderedBlocks = renderedBlocks
  }

  recordPipelineResult(result: RequestPipelineResult): void {
    this.mutablePipelineResult = result
  }
}
