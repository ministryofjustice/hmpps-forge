import type { DomainValidationFailure, StepValidationFailure } from './evaluationState.type'
import type { WorkTask } from './work.type'

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

export type StepValidationWorkTask = WorkTask<'validation.step', StepValidationWorkProps>

export type FieldValidationWorkTask = WorkTask<'validation.field', FieldValidationWorkProps>

export type DomainValidationWorkTask = WorkTask<'validation.domain', DomainValidationWorkProps>
