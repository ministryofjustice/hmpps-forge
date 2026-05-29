import { NodeId } from '../../types/engine.type'
import { JourneyReachabilityState } from '../../types/JourneyReachabilityState.type'
import { AnswerHistory } from '../types/AnswerHistory.type'
import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse } from '../../../framework/types/response.type'
import { ValidationResult } from '../types/ValidationResult.type'

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

export default class RuntimeEvaluationContext {
  constructor(
    readonly request: StepRequest,
    readonly response: StepResponse,
    readonly global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: {},
    },
  ) {}
}
