import type {
  AnswerPreparationContext,
  BasePhaseContext,
  HookLifecycleContext,
  ReachabilityContext,
  RenderCompilationContext,
  ValidationContext,
} from './phaseContexts.type'
import type { DomainValidationFailure, StepValidationFailure } from '../runtime/evaluationState.type'
import type { RenderBlock } from '../../../framework/rendering/types'

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
 * The per-step results of evaluating a navigation plan's compiled leaves,
 * assembled by the navigation walk before the reachability graph is built.
 * Arrays are indexed by step position in the plan's entries array, maintaining
 * a 1:1 correspondence with the plan's step ordering.
 */
export interface CompiledReachabilityResult {
  /** Per-step: result of evaluating the entryWhen predicate (undefined = no predicate) */
  entryWhenResults: (boolean | undefined)[]
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
 * Evaluates one navigation predicate — a step's conditional-entry `entryWhen`
 * or the journey's `resumeWhen`. One such function exists per authored
 * predicate; steps without one have no function and use their static default.
 */
export type CompiledNavigationPredicateFunction = (ctx: ReachabilityContext) => boolean | Promise<boolean>

/**
 * Evaluates one step's forward outcome gotos, cascaded per submit hook: within
 * a hook's outcomes the first defined goto wins, guarded by the hook's `when:`
 * where it is reachability-compilable; separate hooks contribute independently.
 * Returns the resolved goto path strings.
 */
export type CompiledNavigationOutcomesFunction = (ctx: ReachabilityContext) => string[] | Promise<string[]>

/**
 * Resolves one step's tie-breaker priority: the first rule whose `when`
 * predicate matches (or has no predicate) determines the priority; no matching
 * rule yields undefined.
 */
export type CompiledNavigationTieBreakerFunction = (
  ctx: ReachabilityContext,
) => number | undefined | Promise<number | undefined>

/**
 * Collects one step's possible field codes (static and iterator-expanded,
 * de-duplicated) for reachability state projection.
 */
export type CompiledStepFieldCodesFunction = (ctx: ReachabilityContext) => string[] | Promise<string[]>

/**
 * Validates one field, returning its failures (empty when valid). The field's
 * rules run only if they belong to one of the named `groups` (an empty list
 * selects the `default` group). One such function exists per field in a
 * ValidationPlan.
 */
export type CompiledFieldValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
) => StepValidationFailure[] | Promise<StepValidationFailure[]>

/**
 * Validates one cross-field (domain) rule, returning its failures (empty when
 * valid). `groups` gates whether the rule runs (an empty list selects the
 * `default` group).
 */
export type CompiledDomainValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
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
  groups: string[],
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

/**
 * Outcome of one compiled access hook. `executed` is always true for access
 * hooks (a skipped guard still falls through to `continue`); `outcome` drives
 * the access-lifecycle phase: 'continue' proceeds, 'redirect' uses `redirect`,
 * 'error' uses `status`/`message`.
 */
export interface CompiledAccessHookResult {
  executed: boolean
  outcome: 'continue' | 'redirect' | 'error'
  redirect?: string
  status?: number
  message?: string
}

/**
 * Outcome of one compiled submit hook. `executed` is false when the hook's
 * `when`/`guards` predicates skipped it, in which case the submit-lifecycle
 * phase keeps iterating to the next hook; `outcome` drives the submit-lifecycle
 * phase. `validated` records whether the hook invoked ctx.validate during its run.
 */
export interface CompiledSubmitHookResult {
  executed: boolean
  validated: boolean
  outcome: 'continue' | 'redirect' | 'error'
  redirect?: string
  status?: number
  message?: string
}

/**
 * A single access hook lowered to JS. Always compiled async because hook
 * effects are awaited, so it returns a promise the access-lifecycle phase awaits.
 */
export type CompiledAccessHookFunction = (
  ctx: HookLifecycleContext,
) => CompiledAccessHookResult | Promise<CompiledAccessHookResult>

/**
 * A single submit hook lowered to JS. Always compiled async because hook
 * effects are awaited, so it returns a promise the submit-lifecycle phase awaits.
 */
export type CompiledSubmitHookFunction = (
  ctx: HookLifecycleContext,
) => CompiledSubmitHookResult | Promise<CompiledSubmitHookResult>
