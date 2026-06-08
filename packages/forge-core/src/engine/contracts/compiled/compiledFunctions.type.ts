import type {
  AnswerPreparationContext,
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

export type CompiledEntryValidationFunction = (ctx: ValidationContext) => string[] | Promise<string[]>

export interface CompiledRenderResult {
  blocks: RenderBlock[]
  step: Record<string, unknown>
  ancestors: Record<string, unknown>[]
}

export type CompiledRenderFunction = (
  ctx: RenderCompilationContext,
) => CompiledRenderResult | Promise<CompiledRenderResult>

export type CompiledAnswerPreparationFunction = (ctx: AnswerPreparationContext) => void | Promise<void>

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
