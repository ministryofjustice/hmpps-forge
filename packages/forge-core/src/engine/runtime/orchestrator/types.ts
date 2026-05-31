import type { RenderContext } from '../../../framework/rendering/types'
import type { StepRequest } from '../../../framework/types/request.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { NavigationEvaluation } from '../../contracts/navigation/navigationEvaluation.type'
import type RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import type { StepValidityResult } from '../../contracts/runtime/stepValidityResult.type'

export type ForgeResult = { type: 'render'; context: RenderContext } | { type: 'redirect'; url: string }

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
}

export interface RequestPhase {
  readonly name: string
  execute(state: PipelineState): Promise<PhaseOutcome>
}

export interface TerminalPhase {
  readonly name: string
  execute(state: PipelineState): Promise<ForgeResult>
}
