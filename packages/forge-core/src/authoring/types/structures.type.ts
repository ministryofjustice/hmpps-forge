import { SubmitTransition, AccessTransition, ActionTransition, PredicateExpr } from './expressions.type'
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

  /** If true, this step/journey will be marked as hidden in the navigation tree */
  hiddenFromNavigation?: boolean
}

/**
 * Represents a validation rule for a form field.
 * Includes the validation logic, error message, and execution context.
 */
export interface ValidationExpr {
  type: ExpressionType.VALIDATION
  when: PredicateExpr | PredicateTestExprBuilder
  message: ConditionalString
  submissionOnly?: boolean
  details?: Record<string, any>
}

/**
 * Top-level journey definition representing a complete form flow.
 * Journeys contain steps and can have nested child journeys.
 */
export interface JourneyDefinition {
  type: StructureType.JOURNEY
  path: string
  code: string
  onAccess?: AccessTransition[]
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
 * Steps contain blocks and define navigation/transition logic.
 */
export interface StepDefinition {
  type: StructureType.STEP
  path: string
  code?: string
  blocks?: BlockDefinition[]
  onAccess?: AccessTransition[]
  onAction?: ActionTransition[]
  onSubmission?: SubmitTransition[]
  title: string
  view?: ViewConfig
  isEntryPoint?: boolean
  backlink?: string
  metadata?: {
    [key: string]: any
  }
  data?: Record<string, unknown>
  validate?: (ValidationExpr | unknown)[]
}
