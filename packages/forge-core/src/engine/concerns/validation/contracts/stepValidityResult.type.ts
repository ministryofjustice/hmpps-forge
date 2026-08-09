import type { DomainValidationFailure, StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'

/**
 * A step's full recorded failure set — every rule that failed, each tagged with its
 * `submissionOnly` flag and `groups`. Validity is not stored: readers derive it per
 * mode by projecting this set through `stepValidity`.
 */
export interface StepValidityResult {
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}
