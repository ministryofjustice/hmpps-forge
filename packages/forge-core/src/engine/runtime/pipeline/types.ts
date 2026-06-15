import type { RenderContext } from '../../../framework/rendering/types'
import type { StepRequest } from '../../../framework/types/request.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { NavigationEvaluation } from '../../contracts/navigation/navigationEvaluation.type'
import type RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import type { StepValidityResult } from '../../contracts/runtime/stepValidityResult.type'
import type { MaterialisedTemplateNode } from '../../contracts/plans/materialisationArtefacts.type'
import type TraceRecorder from './trace/TraceRecorder'

export type ForgeRedirectResult = { type: 'redirect'; url: string }

/** A lifecycle hook halted the request; `status` is the hook's declared HTTP status. */
export type ForgeErrorResult = { type: 'error'; status: number; message: string }

/**
 * `TOut` is the bound renderer's output type; a pipeline with no renderer
 * defaults it to `undefined` and render results are context-only.
 */
export type ForgeResult<TOut = undefined> =
  | { type: 'render'; context: RenderContext; output: TOut; renderedBlocks: readonly TOut[] }
  | ForgeRedirectResult
  | ForgeErrorResult

export type PhaseOutcome =
  | { action: 'continue' }
  | { action: 'halt-redirect'; target: string; reason: string }
  | { action: 'halt-error'; status: number; message: string }

export interface PipelineState {
  readonly context: RuntimeEvaluationContext
  readonly request: StepRequest
  readonly responseBindings: ResponseBindings
  navigationEvaluation?: NavigationEvaluation
  validation?: StepValidityResult
  showValidationFailures?: boolean
  materialisation?: MaterialisedTemplateNode[]
  /** Hydrated render context, written by the render-evaluation phase for the render-output terminal. */
  renderContext?: RenderContext
  /** Present when the request is being traced; the pipeline and phase walks record decisions here. */
  readonly trace?: TraceRecorder
}

export interface RequestPhase {
  readonly name: string
  execute(state: PipelineState): Promise<PhaseOutcome>
}

export interface TerminalPhase<TOut = undefined> {
  readonly name: string
  execute(state: PipelineState): Promise<ForgeResult<TOut>>
}
