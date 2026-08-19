import type { StepEntryValidationAST } from '../../../chassis/contracts/ast/structures.type'
import type { FieldModel, ValidationRulesModel } from '../../../chassis/contracts/models/fieldModel.type'

/**
 * The validation concern's semantic model for one step. Built by
 * `ValidationAnalyzer`, consumed by `StepValidationCompiler` and
 * `EntryValidationCompiler`. AST nodes survive here only as expression leaves
 * and diagnostic tokens.
 */
export interface ValidationModel {
  /** Script-URL identity segment; `undefined` leaves the script unlabelled. */
  readonly label?: string
  /**
   * Whether the step has real validation (validating registered fields or a
   * domain `validWhen`). Owns the answer to "which steps does the eager
   * validities phase validate" — independent of reachability/navigation.
   */
  readonly hasValidation: boolean
  /** The validating field occurrences, registered first, in document order. */
  readonly fields: readonly FieldModel[]
  /** The step's domain `validWhen` rules; absent when none are configured. */
  readonly domainRules?: ValidationRulesModel
  /** The step's `validateOnEntry` group-selector rules. */
  readonly entryValidation: readonly StepEntryValidationAST[]
}
