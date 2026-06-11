import type { DomainValidationFailure, StepValidationFailure } from './evaluationState.type'

export interface StepValidityResult {
  isValid: boolean
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}

/**
 * Caller-varying inputs for one validation walk. `isSubmission` distinguishes a
 * POST submit from a GET entry check; `groups` restricts evaluation to the
 * named validation groups (an empty list selects the `default` group).
 */
export interface ValidationEvaluationInput {
  isSubmission: boolean
  groups: string[]
}
