import type { DomainValidationFailure, StepValidationFailure } from './evaluationState.type'

export interface ValidationView {
  readonly isValid: boolean
  readonly fieldFailures: StepValidationFailure[]
  readonly domainFailures: DomainValidationFailure[]
}
