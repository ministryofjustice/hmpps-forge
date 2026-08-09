import type { WorkTask } from '../../../contracts/runtime/work.type'

type AnswerPreparationMode = 'GET' | 'POST'

interface AnswerMutation {
  readonly value: unknown
  readonly source: string
}

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
