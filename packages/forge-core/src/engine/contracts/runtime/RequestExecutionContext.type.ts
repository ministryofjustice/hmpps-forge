import type { NodeId } from '../ast/ast.type'
import type { ReachabilityEvaluation } from '../../concerns/reachability/contracts/reachabilityEvaluation.type'
import type { StepValidityResult } from '../../concerns/validation/contracts/stepValidityResult.type'
import type { ValidationView } from '../../concerns/validation/contracts/validationView.type'
import type FunctionRegistry from '../../registries/FunctionRegistry'
import type { RuntimeContext } from './evaluationState.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { ComponentRegistry } from '../../../framework/types/adapter.type'
import type { RenderContext } from '../../../framework/types/rendering.type'
import type { RouteTree } from '../../../framework/types/routeTree.type'
import type { StepValidationWorkTask } from '../../concerns/validation/contracts/ValidationWork.type'

type StepValidationTaskResult = StepValidationWorkTask | undefined

/**
 * The single context threaded through the whole request work tree.
 *
 * The phase work handlers read `context`/`request`/`responseBindings` to build each
 * phase's compiled context and invoke its compiled function, and write the mutable
 * per-request signalling (`reachabilityEvaluation`/`validation`/`showValidationFailures`)
 * that the render phase reads back. Validation-bearing work — the eager `validities`
 * phase, `submit.validation`, and on-entry validation — uses `buildStepValidation`/
 * `recordStepValidation` (always provided by the bootstrap) and `currentStepId`.
 */
export interface RequestExecutionContext {
  readonly context: RuntimeContext
  readonly responseBindings: ResponseBindings
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly currentStepId?: NodeId
  readonly hasRenderer: boolean
  readonly traceEnabled: boolean
  reachabilityEvaluation?: ReachabilityEvaluation
  routeTree?: RouteTree
  validation?: ValidationView
  showValidationFailures?: boolean
  renderContext?: RenderContext
  renderedBlocks?: readonly unknown[]

  /**
   * The pipeline's resolved outcome, published by `request.pipeline` on completion so the
   * surrounding adapter work tree (render, commit) can read it — executor siblings can't
   * read each other's outputs, only the shared context.
   */
  pipelineResult?: RequestPipelineResult

  buildStepValidation(
    stepId: NodeId,
    isSubmission: boolean,
  ): StepValidationTaskResult | Promise<StepValidationTaskResult>

  recordStepValidation(stepId: NodeId, result: StepValidityResult): void
}

/**
 * Uniform per-phase result. The `request.pipeline` first-match drain halts on the
 * first phase whose `action !== 'continue'`. `render` is terminal: it carries the
 * built `RenderContext` the pipeline surfaces as the run's outcome.
 */
export type PhaseWorkOutput =
  | { readonly action: 'continue' }
  | { readonly action: 'render'; readonly renderContext: RenderContext; readonly output?: unknown }
  | { readonly action: 'halt-redirect'; readonly target: string; readonly reason: string }
  | { readonly action: 'halt-error'; readonly status: number; readonly message: string }

/**
 * Output of the `request.pipeline` work handler — the resolved outcome of the run, also
 * published to the shared context. `RequestEvaluator.buildOutcome` turns it into the terminal
 * `ForgeOutcome` (resolving redirect targets to URLs).
 */
export type RequestPipelineResult =
  | { readonly kind: 'render'; readonly context: RenderContext; readonly output?: unknown }
  | { readonly kind: 'redirect'; readonly target: string }
  | { readonly kind: 'error'; readonly status: number; readonly message: string }
