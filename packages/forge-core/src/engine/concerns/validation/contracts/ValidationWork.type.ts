import type {
  DomainValidationFailure,
  StepValidationFailure,
} from '../../../chassis/contracts/runtime/evaluationState.type'
import type { WorkTask } from '../../../chassis/contracts/work/work.type'

/**
 * Selects which validation rules a run executes: only rules tagged with one of
 * `groups` (rules and active groups default to `['default']`), and `submissionOnly`
 * rules only when `includeSubmissionOnly` is true. The compiled validation function
 * applies this filter before any rule condition is evaluated, so rules outside the
 * selection never run.
 */
export interface ValidationRuleFilter {
  readonly groups: readonly string[]
  readonly includeSubmissionOnly: boolean
}

export type CurrentStepValidationWorkProps = ValidationRuleFilter

export interface StepValidationWorkProps {
  readonly fields: readonly FieldValidationWorkTask[]
  readonly domains: readonly DomainValidationWorkTask[]
}

export interface FieldValidationWorkProps {
  readonly blockId: string
  readonly blockCode: string | undefined
  readonly run: () => StepValidationFailure[] | Promise<StepValidationFailure[]>
}

export interface DomainValidationWorkProps {
  readonly run: () => DomainValidationFailure[] | Promise<DomainValidationFailure[]>
}

export type CurrentStepValidationWorkTask = WorkTask<'validation.current-step', CurrentStepValidationWorkProps>

export type StepValidationWorkTask = WorkTask<'validation.step', StepValidationWorkProps>

export type FieldValidationWorkTask = WorkTask<'validation.field', FieldValidationWorkProps>

export type DomainValidationWorkTask = WorkTask<'validation.domain', DomainValidationWorkProps>
