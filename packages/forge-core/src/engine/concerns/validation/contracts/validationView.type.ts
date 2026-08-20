import type {
  DomainValidationFailure,
  StepValidationFailure,
} from '../../../chassis/contracts/runtime/evaluationState.type'

export interface ValidationView {
  readonly isValid: boolean
  readonly fieldFailures: StepValidationFailure[]
  readonly domainFailures: DomainValidationFailure[]
}
