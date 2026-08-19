import type { AnswerMutation } from '../../../contracts/runtime/answerHistory.type'
import type { WorkTask } from '../../../contracts/work/work.type'

type AnswerPreparationMode = 'GET' | 'POST'

export interface AnswerPreparationFieldResult {
  readonly code: string | undefined
  readonly mode: AnswerPreparationMode
  readonly current: unknown
  readonly parsed?: unknown
  readonly mutations: readonly AnswerMutation[]
}

export interface AnswerPreparationResult {
  readonly fields: readonly AnswerPreparationFieldResult[]
}

export interface AnswerPreparationWorkProps {
  readonly fields: readonly FieldAnswerPreparationWorkTask[]
}

export interface FieldAnswerPreparationWorkProps {
  readonly code: string | undefined
  readonly mode: AnswerPreparationMode
  readonly run: () => AnswerPreparationFieldResult | Promise<AnswerPreparationFieldResult>
}

export type FieldAnswerPreparationWorkTask = WorkTask<'answer.preparation.field', FieldAnswerPreparationWorkProps>
