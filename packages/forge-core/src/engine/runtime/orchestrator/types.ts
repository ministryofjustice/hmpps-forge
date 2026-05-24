import type { RenderContext } from '../../../framework/rendering/types'
import type { StepRequest } from '../../../framework/types/request.type'
import type { NavigationEvaluation } from '../../types/NavigationEvaluation.type'
import type RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import type { StepValidityResult } from '../types/StepValidityResult.type'

export type ForgeResult = { type: 'render'; context: RenderContext } | { type: 'redirect'; url: string }

export type PhaseOutcome =
  | { action: 'continue' }
  | { action: 'halt-redirect'; target: string }
  | { action: 'halt-error'; status: number; message: string }

export interface PipelineState {
  readonly context: RuntimeEvaluationContext
  readonly request: StepRequest
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
