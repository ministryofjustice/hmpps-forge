import { DomainValidationFailure, StepValidationFailure } from '../context/RuntimeEvaluationContext'

export interface StepValidityResult {
  isValid: boolean
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}
