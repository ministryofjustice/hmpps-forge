import type { DomainValidationFailure, StepValidationFailure } from './evaluationState.type'

export interface StepValidityResult {
  isValid: boolean
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}
