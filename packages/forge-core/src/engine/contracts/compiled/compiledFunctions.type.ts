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

export type CompiledValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => StepValidityResult | Promise<StepValidityResult>

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

export type CompiledReachabilityFunction = (
  ctx: ReachabilityContext,
) => CompiledReachabilityResult | Promise<CompiledReachabilityResult>

export type CompiledNavigationFunction = (
  ctx: ReachabilityContext,
  navigation: NavigationEvaluationInput,
) => Promise<NavigationEvaluationResult>

export type CompiledFieldValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => StepValidationFailure[] | Promise<StepValidationFailure[]>

export type CompiledDomainValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => DomainValidationFailure[] | Promise<DomainValidationFailure[]>

export interface IteratorItemScope {
  readonly item: unknown
  readonly index: number
  readonly rawItem: unknown
  readonly inputLength: number
}

export type CompiledIteratorInputFunction = (
  ctx: BasePhaseContext,
) => IteratorItemScope[] | Promise<IteratorItemScope[]>

export type CompiledIteratorFieldValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[] | undefined,
  iteratorScope: IteratorItemScope,
) => StepValidationFailure[] | Promise<StepValidationFailure[]>

export type CompiledFieldAnswerPreparationFunction = (ctx: AnswerPreparationContext) => void | Promise<void>

export type CompiledIteratorFieldAnswerPreparationFunction = (
  ctx: AnswerPreparationContext,
  iteratorScope: IteratorItemScope,
) => void | Promise<void>

export type CompiledStepMetadataFunction = (
  ctx: RenderCompilationContext,
) => Record<string, unknown> | Promise<Record<string, unknown>>

export type CompiledAncestorMetadataFunction = (
  ctx: RenderCompilationContext,
) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>

export type CompiledRenderBlockFunction = (ctx: RenderCompilationContext) => RenderBlock | Promise<RenderBlock>

export type CompiledIteratorRenderBlockFunction = (
  ctx: RenderCompilationContext,
  iteratorScope: IteratorItemScope,
) => RenderBlock | RenderBlock[] | Promise<RenderBlock | RenderBlock[]>

export type CompiledEntryValidationRuleFunction = (ctx: BasePhaseContext) => boolean | Promise<boolean>
