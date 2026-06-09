import type {
  AnswerPreparationContext,
  BasePhaseContext,
  ReachabilityContext,
  RenderCompilationContext,
  ValidationContext,
} from './phaseContexts.type'
import type { StepValidityResult } from '../runtime/stepValidityResult.type'
import type { DomainValidationFailure, StepValidationFailure } from '../runtime/evaluationState.type'
import type { RenderBlock } from '../../../framework/rendering/types'
import type {
  NavigationEvaluationInput,
  NavigationEvaluationResult,
} from '../navigation/generatedNavigationEvaluation.type'

/**
 * Validates a whole step in one call: runs every field, iterator-group field
 * (once per expanded item), and domain rule, then aggregates them into a single
 * StepValidityResult (valid only when no failures remain). `isSubmission`
 * distinguishes POST validation from GET entry validation; `groups`, when
 * present, restricts evaluation to the named validation groups (defaulting to
 * the `default` group otherwise). Always async.
 */
export type CompiledValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => StepValidityResult | Promise<StepValidityResult>

/**
 * The render output for one step: the ordered render blocks plus the resolved
 * metadata bag for the step itself and one bag per ancestor (outermost first).
 */
export interface CompiledRenderResult {
  blocks: RenderBlock[]
  step: Record<string, unknown>
  ancestors: Record<string, unknown>[]
}

/**
 * The result of calling the compiled reachability function. Arrays are indexed
 * by step position in the ReachabilityCompilationPlan.entries array, maintaining a
 * 1:1 correspondence with the plan's step ordering.
 */
export interface CompiledReachabilityResult {
  /** Per-step: result of evaluating the entryWhen predicate (undefined = no predicate) */
  entryResults: (boolean | undefined)[]
  /** Per-step: raw path strings from forward outcome goto expressions, narrowed by per-hook cascade */
  outcomeValues: (string | undefined)[][]
  /** Per-step: every statically-declared forward goto across all hooks, regardless of any guards (devtools-only) */
  declaredOutcomeValues: (string | undefined)[][]
  /** Per-step: resolved tie-breaker priority from the first matching rule */
  tieBreakerPriorities: (number | undefined)[]
  /** Whether the journey's resume condition evaluated to true */
  resumeActive: boolean
}

/**
 * Evaluates every step's entry predicate and forward-goto outcomes for the whole
 * journey in one pass, returning the per-step arrays used to compute reachability.
 * Async iff any predicate or goto expression awaits.
 */
export type CompiledReachabilityFunction = (
  ctx: ReachabilityContext,
) => CompiledReachabilityResult | Promise<CompiledReachabilityResult>

/**
 * Resolves navigation for the current request: runs reachability against `ctx`,
 * then resolves the result into a concrete next-step evaluation using the plan,
 * route catalog, and field inventory carried on `navigation`. Always async.
 */
export type CompiledNavigationFunction = (
  ctx: ReachabilityContext,
  navigation: NavigationEvaluationInput,
) => Promise<NavigationEvaluationResult>

/**
 * Validates one field, returning its failures (empty when valid). When `groups`
 * is given, the field's rules run only if they belong to one of those groups.
 * One such function exists per field in a ValidationPlan.
 */
export type CompiledFieldValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => StepValidationFailure[] | Promise<StepValidationFailure[]>

/**
 * Validates one cross-field (domain) rule, returning its failures (empty when
 * valid). `groups`, when present, gates whether the rule runs.
 */
export type CompiledDomainValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => DomainValidationFailure[] | Promise<DomainValidationFailure[]>

/**
 * One iteration scope produced by expanding a MAP iterator's collection. Every
 * field/block in the iterator group runs once per scope; @scope/@loop references
 * resolve against these values.
 */
export interface IteratorItemScope {
  /** The per-item value bound for this iteration */
  readonly item: unknown
  /** Zero-based position of the item within the collection */
  readonly index: number
  /** The item before any per-iterator transformation */
  readonly rawItem: unknown
  /** Total number of items in the expanded collection */
  readonly inputLength: number
}

/**
 * Expands a MAP iterator's source collection into one scope per item. Returns an
 * empty array for an empty or absent collection, so the group simply produces
 * nothing. Async iff resolving the collection awaits.
 */
export type CompiledIteratorInputFunction = (
  ctx: BasePhaseContext,
) => IteratorItemScope[] | Promise<IteratorItemScope[]>

/**
 * Validates one iterator-group field for a single item scope, returning that
 * item's failures. The caller invokes it once per IteratorItemScope; nesting is
 * handled inside the compiled body, which walks any intermediate iterator levels.
 */
export type CompiledIteratorFieldValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[] | undefined,
  iteratorScope: IteratorItemScope,
) => StepValidationFailure[] | Promise<StepValidationFailure[]>

/**
 * Formats one field's submitted/default answer and mutates ctx.answers in place,
 * appending the resulting value to the field's mutation log. Returns nothing.
 */
export type CompiledFieldAnswerPreparationFunction = (ctx: AnswerPreparationContext) => void | Promise<void>

/**
 * Answer preparation for one iterator-group field, scoped to a single item.
 * Mutates ctx.answers in place for that item; invoked once per IteratorItemScope.
 */
export type CompiledIteratorFieldAnswerPreparationFunction = (
  ctx: AnswerPreparationContext,
  iteratorScope: IteratorItemScope,
) => void | Promise<void>

/**
 * Resolves the current step's render-time metadata bag (the `step` entry of
 * CompiledRenderResult).
 */
export type CompiledStepMetadataFunction = (
  ctx: RenderCompilationContext,
) => Record<string, unknown> | Promise<Record<string, unknown>>

/**
 * Resolves one metadata bag per ancestor step, ordered outermost-first (the
 * `ancestors` entry of CompiledRenderResult).
 */
export type CompiledAncestorMetadataFunction = (
  ctx: RenderCompilationContext,
) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>

/**
 * Produces a single RenderBlock for one non-iterator block in the RenderPlan.
 */
export type CompiledRenderBlockFunction = (ctx: RenderCompilationContext) => RenderBlock | Promise<RenderBlock>

/**
 * Produces the RenderBlock(s) for one iterator-group block at a single item
 * scope. May return an array when the block expands to multiple blocks (e.g. an
 * inner iterator level); invoked once per IteratorItemScope.
 */
export type CompiledIteratorRenderBlockFunction = (
  ctx: RenderCompilationContext,
  iteratorScope: IteratorItemScope,
) => RenderBlock | RenderBlock[] | Promise<RenderBlock | RenderBlock[]>

/**
 * Selects which validation groups run on GET entry: a per-rule predicate that
 * gates the rule's groups when it evaluates true.
 */
export type CompiledEntryValidationRuleFunction = (ctx: BasePhaseContext) => boolean | Promise<boolean>
