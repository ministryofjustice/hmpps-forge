import { SubmitHook, AccessHook, ActionHook, PredicateExpr } from './expressions.type'
import { PredicateTestExprBuilder } from '../builders/PredicateTestExprBuilder'
import { ExpressionType, StructureType } from './enums'
import type { BlockDefinition, ConditionalString } from '../../components/types/structures.type'

/**
 * View configuration for journeys and steps.
 * Controls rendering behavior including template selection and template locals.
 */
export interface ViewConfig {
  /** Template to use for rendering (inherits from parent journey if not specified) */
  template?: string

  /** Arbitrary properties to pass to the template as locals */
  locals?: Record<string, unknown>
}

/**
 * Represents a validation rule for a form field.
 * Includes the validation logic, error message, and execution context.
 */
export interface ValidationExpr {
  type: ExpressionType.VALIDATION
  /** A predicate that must be `true` for the field to be considered valid. */
  condition: PredicateExpr | PredicateTestExprBuilder
  /** The error message shown when the condition fails. Can be a plain string, a reference expression, or a format expression. */
  message: ConditionalString
  /** When `true`, the rule only runs on form submission, not during navigation/traversal checks. Useful for expensive or time-sensitive validations. */
  submissionOnly?: boolean
  /** Metadata passed to the error handler, e.g. `{ field: 'month' }` to highlight a specific part of a composite input like a date. */
  details?: Record<string, any>
}

export type ValidationProps = Omit<ValidationExpr, 'type'>

/**
 * Top-level journey definition representing a complete form flow.
 * Journeys contain steps and can have nested child journeys.
 */
export interface JourneyDefinition {
  type: StructureType.JOURNEY
  path: string
  code: string
  onAccess?: AccessHook[]
  steps?: StepDefinition[]
  children?: JourneyDefinition[]
  title: string
  description?: string
  view?: ViewConfig
  entryPath?: string
  metadata?: {
    [key: string]: any
  }
  data?: Record<string, unknown>
}

/**
 * Definition for a single step within a journey.
 * Steps contain blocks and define navigation/hook logic.
 */
export interface StepDefinition {
  type: StructureType.STEP
  path: string
  code?: string
  blocks?: BlockDefinition[]
  onAccess?: AccessHook[]
  onAction?: ActionHook[]
  onSubmission?: SubmitHook[]
  title: string
  view?: ViewConfig
  isEntryPoint?: boolean
  backlink?: string
  metadata?: {
    [key: string]: any
  }
  data?: Record<string, unknown>
  /**
   * Validation rules for this step. Rules are checked in order.
   *
   * @example
   * validWhen: [
   *   validation({
   *     condition: Self().match(Condition.IsRequired()),
   *     message: 'Select an option',
   *   }),
   * ]
   */
  validWhen?: (ValidationExpr | unknown)[]
  cleardownFieldCodes?: string[]
}
