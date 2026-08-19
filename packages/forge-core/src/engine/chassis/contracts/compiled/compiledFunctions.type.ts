import type {
  CompiledAnswerPreparationContext,
  CompiledReachabilityContext,
  CompiledResolveContext,
  CompiledRouteMetadataContext,
  CompiledValidationContext,
} from './compiledContexts.type'
import { NodeId } from '../ast/ast.type'
import { BlockType } from '../../../../authoring/types/enums'
import type {
  ReachabilityEvaluationResult,
  ReachabilityStateInput,
} from '../../../concerns/reachability/contracts/generatedReachabilityEvaluation.type'
import type { ValidationRuleFilter } from '../../../concerns/validation/contracts/ValidationWork.type'

export type CompiledStaticDataFunction = () => Record<string, unknown>

export interface ResolvedRouteMetadataEntry {
  title?: string
  description?: string
  metadata?: Record<string, unknown>
}

/**
 * Per-request resolved route metadata, keyed by the node ID of the step or
 * journey each entry describes. The package-level route-metadata function builds
 * this in one pass; the resolve phase merges it onto the statically built route
 * topology by node ID.
 */
export type ResolvedRouteMetadata = Record<NodeId, ResolvedRouteMetadataEntry>

/**
 * The package-level compiled function. Evaluates every step's and journey's
 * authored title/description/metadata expressions and returns them keyed by node
 * ID, ready to merge onto the route tree. Like CompiledStaticDataFunction it
 * returns plain data rather than a work task.
 */
export type CompiledRouteMetadataFunction = (
  ctx: CompiledRouteMetadataContext,
) => ResolvedRouteMetadata | Promise<ResolvedRouteMetadata>

export type CompiledValidationFunction = (
  ctx: CompiledValidationContext,
  filter: ValidationRuleFilter,
) => CompiledValidationWorkTask | Promise<CompiledValidationWorkTask>

export type CompiledEntryValidationFunction = (ctx: CompiledValidationContext) => string[] | Promise<string[]>

export interface CompiledResolveBlockWorkProps {
  readonly id: NodeId
  readonly variant: string
  readonly blockType: BlockType
  readonly properties: Record<PropertyKey, unknown>
}

export interface CompiledValidationWorkTask {
  readonly $$typeof: symbol
  readonly key: string
  readonly handler: unknown
  readonly props: unknown
}

interface CompiledAnswerPreparationWorkTask {
  readonly $$typeof: symbol
  readonly key: string
  readonly handler: unknown
  readonly props: unknown
}

export interface CompiledResolveBlockWorkTask {
  readonly $$typeof: symbol
  readonly key: string
  readonly handler: unknown
  readonly props: CompiledResolveBlockWorkProps
}

interface CompiledResolveBlocksWorkProps {
  readonly blocks: CompiledResolveBlockWorkTask[]
  readonly step: Record<string, unknown>
  readonly ancestors: Record<string, unknown>[]
}

interface CompiledResolveBlocksWorkTask {
  readonly $$typeof: symbol
  readonly key: string
  readonly handler: unknown
  readonly props: CompiledResolveBlocksWorkProps
}

export type CompiledResolveFunction = (
  ctx: CompiledResolveContext,
) => CompiledResolveBlocksWorkTask | Promise<CompiledResolveBlocksWorkTask>

export type CompiledAnswerPreparationFunction = (
  ctx: CompiledAnswerPreparationContext,
) => CompiledAnswerPreparationWorkTask | Promise<CompiledAnswerPreparationWorkTask>

/**
 * The result of calling the compiled reachability function. Arrays are indexed
 * by step position in the ReachabilityModel.entries array, maintaining a
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
 * Evaluates the journey's dynamic reachability expressions (entry predicates,
 * forward outcomes, tie-breakers, resume condition). The static graph walk that
 * turns these facts into reachability state lives in
 * `CompiledReachabilityStateFunction`.
 */
export type CompiledReachabilityFactsFunction = (
  ctx: CompiledReachabilityContext,
) => CompiledReachabilityResult | Promise<CompiledReachabilityResult>

/**
 * Turns precomputed reachability facts and per-step validities into the full
 * reachability evaluation (and, when field inventory and params are present, its
 * consumer-facing projection). Lowering binds the static navigation plan into the
 * closure, so the runtime calls it with request-time inputs only.
 */
export type CompiledReachabilityStateFunction = (input: ReachabilityStateInput) => ReachabilityEvaluationResult
