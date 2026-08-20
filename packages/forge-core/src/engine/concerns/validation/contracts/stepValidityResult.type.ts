import type {
  DomainValidationFailure,
  StepValidationFailure,
} from '../../../chassis/contracts/runtime/evaluationState.type'

/**
 * A step's recorded failure set from one validation run — every selected rule that
 * failed, each tagged with its `submissionOnly` flag and `groups`. Rule selection
 * happens before execution, so validity is simply "no failures recorded".
 */
export interface StepValidityResult {
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}
