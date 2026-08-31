import {
  IterateExpr,
  ResolvableValue,
  SubmitHook,
  AccessHook,
  PredicateExpr,
  GeneratorFunctionExpr,
} from './expressions.type'
import { PolicyType, StructureType } from '../../shared/taxonomy'
import type { ChainableGenerator, ChainableIterable } from '../builders/types'
import type { BlockDefinition, ResolvableBoolean, ResolvableString } from '../../components/types/structures.type'
import type { RendererInvocation } from '../../components/types/renderFunctions.type'

/**
 * View configuration for journeys and steps.
 * Forge combines journey configurations from root to leaf, then applies the
 * current step configuration before passing the effective view to the renderer.
 */
export interface ViewConfig {
  /** Template identifier. The nearest journey or current step declaration wins. */
  template?: string

  /** Template locals merged by key from the root journey to the current step. */
  locals?: Record<string, unknown>
}

interface BaseValidationExpr {
  /** Internal Forge discriminator. Do not set or override this property. */
  _forge: PolicyType.VALIDATION_RULE
  /** When `true`, the rule only runs on form submission, not during navigation/traversal checks. Useful for expensive or time-sensitive validations. */
  submissionOnly?: boolean
  /** Validation groups this rule belongs to. Defaults to `['default']` when omitted or empty. */
  groups?: string[]
}

/** One error returned by a generator-backed validation function. */
export interface ValidationFunctionError {
  message: string
  details?: Record<string, unknown>
}

/** The value a generator-backed validation function returns. `undefined` or an empty array means valid. */
export type ValidationFunctionResult = readonly ValidationFunctionError[] | undefined

/** A validation rule whose authored predicate must pass. */
export interface ConditionValidationExpr extends BaseValidationExpr {
  /** A predicate that must be `true` for the field to be considered valid. */
  condition: PredicateExpr
  /** The error message shown when the condition fails. Can be a plain string, a reference expression, or a format expression. */
  message: ResolvableString
  /** Metadata passed to the error handler, e.g. `{ field: 'month' }` to highlight a specific part of a composite input like a date. */
  details?: Record<string, unknown>
  function?: never
}

/** A validation rule whose generator returns zero or more validation errors. */
export interface FunctionValidationExpr extends BaseValidationExpr {
  function: GeneratorFunctionExpr | ChainableGenerator
  condition?: never
  message?: never
  details?: never
}

/** Represents either a predicate-backed or generator-backed validation rule. */
export type ValidationExpr = ConditionValidationExpr | FunctionValidationExpr

export type ValidationProps = Omit<ConditionValidationExpr, '_forge'> | Omit<FunctionValidationExpr, '_forge'>

type ValidWhenInput = ValidationExpr | IterateExpr | ChainableIterable

/**
 * A prioritised rule that participates in tie-breaking during reachability,
 * backlink, and resume resolution. The first entry whose `when` evaluates
 * truthy (or which has no `when`) supplies the step's priority; the highest
 * priority among competing candidates wins, with journey declaration order
 * as the final tiebreaker.
 */
export interface TieBreaker {
  /** Internal Forge discriminator. Do not set or override this property. */
  _forge: PolicyType.NAVIGATION_TIE_BREAKER
  /** Priority value — higher beats lower. */
  priority: number
  /** Predicate that must hold for this priority to apply. Omit for a catch-all. */
  when?: PredicateExpr
}

export type TieBreakerProps = Omit<TieBreaker, '_forge'>

/**
 * Where Forge redirects a request for an unreachable step: the journey's
 * default active entry point, or the current resume frontier.
 *
 * @see {@link JourneyReachability.unreachableRedirect}
 */
export type UnreachableRedirectTarget = 'entry' | 'frontier'

/**
 * Custom key/value pairs attached to a journey or step, surfaced on the
 * route tree and render context. Values may be expressions, resolved per
 * request.
 *
 * @see {@link JourneyDefinition.metadata}
 * @see {@link StepDefinition.metadata}
 */
export type RouteMetadata = Record<string, ResolvableValue | undefined>

/**
 * Top-level journey definition representing a complete form flow.
 * Journeys contain steps and can have nested child journeys.
 */
export interface JourneyDefinition<TBlocks = BlockDefinition[]> {
  /** Internal Forge discriminator. Do not set or override this property. */
  _forge: StructureType.JOURNEY

  /**
   * URL segment this journey mounts under.
   * Nested journeys append their path to their parent's; the root journey
   * mounts under the base path the Forge instance was created with.
   *
   * @example
   * path: '/goals'
   *
   * @example
   * // Route parameters are declared with a colon
   * path: '/goals/:goalId'
   */
  path: string

  /**
   * Stable identifier for the journey, independent of its URL path.
   * The root journey's code identifies the whole registered package: it
   * scopes the engine's route keys and appears in compilation traces and
   * diagnostics, so it must be unique across registered packages.
   *
   * @example
   * code: 'prison-visit-booking'
   */
  code: string

  /**
   * Lifecycle hooks run on every request to this journey or any step or
   * child journey beneath it, before the step's own hooks. Use them for
   * access control and data loading.
   *
   * @example
   * onAccess: [access({ effects: [loadUserData()] })]
   *
   * @see {@link AccessHook} for hook evaluation order and outcomes
   */
  onAccess?: AccessHook[]

  /**
   * Steps belonging directly to this journey, routed under its path.
   *
   * @see {@link StepDefinition}
   */
  steps?: StepDefinition<TBlocks>[]

  /**
   * Child journeys nested under this one, routed beneath this journey's
   * path.
   */
  children?: JourneyDefinition<TBlocks>[]

  /**
   * Display title for the journey, surfaced on the route tree and as a
   * journey ancestor in the render context. The title may be an expression,
   * resolved per request.
   *
   * @example
   * title: 'Book a prison visit'
   *
   * @example
   * // Titles may be expressions
   * title: Format('Visit for %1', Data('prisonerName'))
   */
  title: ResolvableString

  /** Default page renderer inherited unchanged by descendant steps. */
  renderer?: RendererInvocation

  /**
   * Optional display description, surfaced alongside {@link title} on the
   * route tree. The description may be an expression, resolved per request.
   */
  description?: ResolvableString

  /**
   * View configuration for rendering this journey's steps. Combined from
   * the root journey down to the current step: the nearest `template` wins
   * and `locals` merge by key.
   *
   * @see {@link ViewConfig}
   */
  view?: ViewConfig

  /**
   * Custom key/value pairs surfaced on the route tree and render context,
   * for concerns like navigation labels or template flags.
   * Values may be expressions, resolved per request.
   *
   * @example
   * metadata: { section: 'sentencing', navLabel: 'Goals' }
   *
   * @example
   * // Values may be expressions
   * metadata: { navLabel: Data('journeyTitle') }
   */
  metadata?: RouteMetadata

  /**
   * Static data merged into the request's data context, readable with
   * `Data()` references. Merges root-first, so a step's or child journey's
   * keys override this journey's. Plain values only; expressions are
   * rejected at registration.
   *
   * @example
   * data: { supportEmail: 'help@justice.gov.uk' }
   * // Read elsewhere with Data('supportEmail')
   */
  data?: Record<string, unknown>

  /**
   * Controls resume behaviour and how unreachable-step requests are
   * redirected for this journey.
   *
   * @see {@link JourneyReachability}
   */
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
   * - `true` — resume is always active: GET requests to a step other than the
   *   resume frontier redirect to it, once progress and a frontier exist.
   * - A dynamic expression — resume only when the expression resolves to a
   *   truthy value; a falsy result behaves the same as `false`.
   * - `false` — behaves the same as omitting it (resume is never active).
   * - Omitted — resume is never active; users access any reachable step freely.
   *
   * @example
   * reachability: { resumeWhen: true }
   * reachability: { resumeWhen: Query('resume').match(Condition.Equals('true')) }
   */
  resumeWhen?: ResolvableBoolean

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
   * - A dynamic expression — conditional entry point, seeded only when the
   *   expression resolves to a truthy value. An active conditional entry
   *   whose path already has progress can anchor the resume frontier past
   *   an earlier blocker.
   * - `false` — behaves the same as omitting it (not an entry point).
   *
   * @example
   * reachability: { entryWhen: true }
   * reachability: { entryWhen: Session('submitted').match(Condition.Equals(true)) }
   */
  entryWhen?: ResolvableBoolean

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

interface StepEntryValidation {
  groups: string[]

  /**
   * Controls when these groups are validated as the step is entered.
   *
   * - `true` — the groups are always validated on entry.
   * - A dynamic expression — the groups are validated only when the expression
   *   resolves to a truthy value.
   * - `false` — behaves the same as omitting the entry (the rule never fires).
   */
  when: ResolvableBoolean
}

/**
 * Definition for a single step within a journey.
 * Steps contain blocks and define navigation/hook logic.
 */
export interface StepDefinition<TBlocks = BlockDefinition[]> {
  /** Internal Forge discriminator. Do not set or override this property. */
  _forge: StructureType.STEP

  /**
   * URL segment appended to the owning journey's path to form the step's
   * route.
   *
   * @example
   * path: '/overview'
   *
   * @example
   * // Route parameters are declared with a colon
   * path: '/record/:index'
   */
  path: string

  /**
   * Optional stable identifier for the step, independent of its URL path.
   * Surfaced in reachability projections and diagnostic traces so steps can
   * be recognised without relying on their (possibly parameterised) path.
   *
   * @example
   * code: 'check-answers'
   */
  code?: string

  /**
   * Content of the step. The default is an ordered block array; a custom page
   * renderer may define a typed arrangement of arrays and named regions.
   * Blocks are built with registered components: field blocks collect answers,
   * basic blocks display content.
   *
   * @see {@link BlockDefinition}
   */
  blocks?: TBlocks

  /**
   * Lifecycle hooks run on every request to this step, after the hooks of
   * its ancestor journeys. Use them for access control and data loading.
   *
   * @example
   * onAccess: [access({ effects: [loadGoal()] })]
   *
   * @see {@link AccessHook} for hook evaluation order and outcomes
   */
  onAccess?: AccessHook[]

  /**
   * Hooks run when the step is submitted. The first hook whose `when` and
   * `guards` pass executes; the rest are skipped.
   *
   * @example
   * onSubmission: [
   *   submit({
   *     validate: true,
   *     onValid: {
   *       effects: [saveGoal()],
   *       next: [redirect({ goto: '/overview' })],
   *     },
   *   }),
   * ]
   *
   * @see {@link SubmitHook} for validation routing and outcomes
   */
  onSubmission?: SubmitHook[]

  /**
   * Surfaces existing validation failures when the step is loaded, without
   * a submission. Each entry names the validation groups to surface and a
   * `when` controlling whether they are.
   *
   * @example
   * // A check-answers step showing any outstanding failures on arrival
   * validateOnEntry: [{ groups: ['default'], when: true }]
   *
   * @see {@link StepEntryValidation}
   */
  validateOnEntry?: StepEntryValidation[]

  /**
   * Display title for the step, surfaced on the route tree and render
   * context. The title may be an expression, resolved per request.
   *
   * @example
   * title: 'Check your answers'
   *
   * @example
   * // Titles may be expressions
   * title: Format('Edit goal %1', Params('goalId'))
   */
  title: ResolvableString

  /** Page renderer for this step. Replaces an inherited journey renderer as a whole. */
  renderer?: RendererInvocation

  /**
   * Optional display description, surfaced alongside {@link title} on the
   * route tree. The description may be an expression, resolved per request.
   */
  description?: ResolvableString

  /**
   * View configuration for rendering this step. Applied on top of the
   * combined view of its ancestor journeys: the nearest `template` wins
   * and `locals` merge by key.
   *
   * @see {@link ViewConfig}
   */
  view?: ViewConfig

  /**
   * Controls how this step participates in the reachability walk: whether
   * it is an entry point, and how ties between candidates are broken.
   *
   * @see {@link StepReachability}
   */
  reachability?: StepReachability

  /**
   * Overrides the back link shown on this step. When omitted, Forge derives
   * it from the reachability walk (the previous reachable step). The value
   * is rendered as-is, so the browser resolves relative targets against the
   * step's URL.
   *
   * @example
   * backlink: 'tasks'
   *
   * @example
   * // Point at a hub step in the parent journey
   * backlink: '../tasks'
   */
  backlink?: string

  /**
   * Custom key/value pairs surfaced on the route tree and render context,
   * for concerns like navigation labels or template flags.
   * Values may be expressions, resolved per request.
   *
   * @example
   * metadata: { navLabel: 'Check answers', hideFromNav: true }
   *
   * @example
   * // Values may be expressions
   * metadata: { navLabel: Answer('nickname') }
   */
  metadata?: RouteMetadata

  /**
   * Static data merged into the request's data context, readable with
   * `Data()` references. Merges root-first, so this step's keys override
   * its ancestor journeys'. Plain values only; expressions are rejected
   * at registration.
   *
   * @example
   * data: { maxAttachments: 5 }
   * // Read elsewhere with Data('maxAttachments')
   */
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

  /**
   * Regex patterns matched against answer keys when this step becomes
   * unreachable. Matching answers are cleared alongside the step's own field
   * answers. Use this for answers the step stores under dynamic keys that
   * its blocks don't declare.
   *
   * @example
   * // Clear every answer stored under the visitDetails prefix
   * cleardownFieldCodes: ['^visitDetails\\.']
   */
  cleardownFieldCodes?: string[]
}
