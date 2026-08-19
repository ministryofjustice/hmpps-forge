import type { FieldModel } from '../../../chassis/contracts/models/fieldModel.type'

/**
 * The answer-preparation concern's semantic model for one step (or, at journey
 * scope, the aggregation of every owned step's fields in step order). Built by
 * `AnswerPreparationAnalyzer`, consumed by `StepAnswerPreparationCompiler`.
 * AST nodes survive here only as expression leaves and diagnostic tokens.
 */
export interface AnswerPreparationModel {
  /** Script-URL identity segment; `undefined` leaves the script unlabelled. */
  readonly label?: string
  /** Every field occurrence, registered first, then template occurrences in document order. */
  readonly fields: readonly FieldModel[]
}
