import type {
  CompiledAnswerPreparationContext,
  CompiledNavigationContext,
  CompiledReachabilityContext,
  CompiledResolveContext,
  CompiledValidationContext,
} from './compiledContexts.type'
import { NodeId } from '../ast/ast.type'
import { BlockType } from '../../../authoring/types/enums'
import type { ReachabilityEvaluationInput } from '../navigation/generatedReachabilityEvaluation.type'

export type CompiledStaticDataFunction = () => Record<string, unknown>

export type CompiledValidationFunction = (
  ctx: CompiledValidationContext,
  isSubmission: boolean,
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

export interface CompiledAnswerPreparationWorkTask {
  readonly $$typeof: symbol
  readonly key: string
  readonly handler: unknown
  readonly props: unknown
}

export interface CompiledNavigationWorkTask {
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

export interface CompiledResolveBlocksWorkProps {
  readonly blocks: CompiledResolveBlockWorkTask[]
  readonly step: Record<string, unknown>
  readonly ancestors: Record<string, unknown>[]
}

export interface CompiledResolveBlocksWorkTask {
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
  ctx: CompiledReachabilityContext,
) => CompiledReachabilityResult | Promise<CompiledReachabilityResult>

export type CompiledNavigationFunction = (
  ctx: CompiledNavigationContext,
  navigation: ReachabilityEvaluationInput,
) => CompiledNavigationWorkTask | Promise<CompiledNavigationWorkTask>
