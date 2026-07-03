import type { WorkTask } from './work.type'

export type AnswerPreparationMode = 'GET' | 'POST'

export interface AnswerMutation {
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

export type AnswerPreparationWorkTask = WorkTask<'answer.preparation', AnswerPreparationWorkProps>

export type FieldAnswerPreparationWorkTask = WorkTask<'answer.preparation.field', FieldAnswerPreparationWorkProps>
