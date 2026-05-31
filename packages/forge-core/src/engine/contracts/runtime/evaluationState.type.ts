import type { NodeId } from '../ast/engine.type'
import type { AnswerHistory } from './answerHistory.type'
import type { JourneyReachabilityState } from '../navigation/journeyReachabilityState.type'
import type { ValidationResult } from './validationResult.type'

export interface StepValidationFailure extends ValidationResult {
  blockId: NodeId
}

export type DomainValidationFailure = ValidationResult

export interface StepValidationState {
  stepId: NodeId
  validated: boolean
  groups?: string[]
  isSubmission?: boolean
  isValid: boolean
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}

/**
 * Global mutable state shared by the compiled functions for one request.
 */
export interface RuntimeEvaluationGlobalState {
  data: Record<string, unknown>
  answers: Record<string, AnswerHistory>
  validation?: StepValidationState
  reachability?: JourneyReachabilityState
}
