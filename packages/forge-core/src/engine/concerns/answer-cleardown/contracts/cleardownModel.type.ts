import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { FieldModel } from '../../../chassis/contracts/models/fieldModel.type'

/**
 * The answer-cleardown concern's semantic model for one journey: the field
 * inventory each owned step can produce. Built by `AnswerCleardownAnalyzer`,
 * consumed by `StepFieldInventoryCompiler`. AST nodes survive here only as
 * expression leaves and diagnostic tokens.
 */
export interface CleardownModel {
  /** Script-URL identity segment; `undefined` leaves the script unlabelled. */
  readonly label?: string
  /** One entry per owned step, in document order. */
  readonly steps: readonly CleardownStepModel[]
}

export interface CleardownStepModel {
  readonly stepId: NodeId
  /** Every field occurrence the step owns, registered first, in document order. */
  readonly fields: readonly FieldModel[]
  readonly cleardownFieldCodes: readonly string[]
}
