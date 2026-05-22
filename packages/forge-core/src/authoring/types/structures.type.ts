import { IterateExpr, SubmitHook, AccessHook, PredicateExpr } from './expressions.type'
import { PredicateTestExprBuilder } from '../builders/PredicateTestExprBuilder'
import { ExpressionType, StructureType } from './enums'
import type { ChainableIterable } from '../builders/types'
import type { BlockDefinition, ResolvableString } from '../../components/types/structures.type'

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
  message: ResolvableString
  /** When `true`, the rule only runs on form submission, not during navigation/traversal checks. Useful for expensive or time-sensitive validations. */
  submissionOnly?: boolean
  /** Validation groups this rule belongs to. Defaults to `['default']` when omitted. */
  groups?: string[]
  /** Metadata passed to the error handler, e.g. `{ field: 'month' }` to highlight a specific part of a composite input like a date. */
  details?: Record<string, any>
}

export type ValidationProps = Omit<ValidationExpr, 'type'>

export type ValidWhenInput = ValidationExpr | IterateExpr | ChainableIterable

/**
 * A prioritised rule that participates in tie-breaking during reachability,
 * backlink, and resume resolution. The first entry whose `when` evaluates
 * truthy (or which has no `when`) supplies the step's priority; the highest
 * priority among competing candidates wins, with journey declaration order
 * as the final tiebreaker.
 */
export interface TieBreaker {
  type: ExpressionType.TIE_BREAKER
  /** Priority value — higher beats lower. */
  priority: number
  /** Predicate that must hold for this priority to apply. Omit for a catch-all. */
  when?: PredicateExpr | PredicateTestExprBuilder
}

export type TieBreakerProps = Omit<TieBreaker, 'type'>

export type UnreachableRedirectTarget = 'entry' | 'frontier'

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
  metadata?: {
    [key: string]: any
  }
  data?: Record<string, unknown>
  reachability?: JourneyReachability
}

/**
 * Journey-level reachability configuration. Controls whether the resume
 * resolver is active — when it is, users are redirected to their furthest
 * incomplete step instead of being able to access any reachable step freely.
 */
export interface JourneyReachability {
  /**
   * Controls when Forge's resume behaviour is active for this journey.
   *
   * - `true` — always resume (every request redirects to the resume frontier).
   * - A predicate expression — resume only when the condition evaluates to true.
   * - Omitted — resume is never active; users access any reachable step freely.
   *
   * @example
   * reachability: { resumeWhen: true }
   * reachability: { resumeWhen: Query('resume').match(Condition.Equals('true')) }
   */
  resumeWhen?: true | PredicateExpr | PredicateTestExprBuilder

  /**
   * Controls where Forge redirects when a requested step is not reachable.
   *
   * - `entry` — redirect to the default active entry point.
   * - `frontier` — redirect to the current frontier when one exists, otherwise
   *   fall back to the default active entry point.
   *
   * @example
   * reachability: { unreachableRedirect: 'frontier' }
   */
  unreachableRedirect?: UnreachableRedirectTarget

  /**
   * Disables the reachability BFS walk for this journey. All steps are
   * treated as reachable without requiring entry points or forward edges.
   *
   * Child journeys inherit this setting but can override it with an
   * explicit `false` to re-enable reachability checks.
   *
   * @example
   * reachability: { disableReachabilityChecks: true }
   */
  disableReachabilityChecks?: boolean
}

/**
 * Reachability configuration for a step. Controls how the step participates
 * in the reachability walk that determines which steps a user can access.
 */
export interface StepReachability {
  /**
   * Declares this step as an entry point for the reachability walk.
   *
   * - `true` — unconditional entry point (always seeded as reachable).
   * - A predicate expression — conditional entry point, seeded only when the
   *   condition evaluates to true. Active conditional entries take priority
   *   in the resume frontier over normal blockers.
   *
   * @example
   * reachability: { entryWhen: true }
   * reachability: { entryWhen: Session('submitted').match(Condition.Equals(true)) }
   */
  entryWhen?: true | PredicateExpr | PredicateTestExprBuilder

  /**
   * Prioritised tie-breaker rules consulted whenever this step is one of
   * several equally-valid candidates. Rules are evaluated top-to-bottom;
   * the first matching entry supplies the step's priority.
   *
   * @example
   * reachability: {
   *   entryWhen: true,
   *   tieBreakers: [tieBreaker({ priority: 100 })],
   * }
   */
  tieBreakers?: TieBreaker[]
}

export interface StepEntryValidation {
  groups: string[]
  when: true | PredicateExpr | PredicateTestExprBuilder
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
  onSubmission?: SubmitHook[]
  validateOnEntry?: StepEntryValidation[]
  title: string
  view?: ViewConfig
  reachability?: StepReachability
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
  validWhen?: ValidWhenInput[] | IterateExpr | ChainableIterable
  cleardownFieldCodes?: string[]
}
