import type FunctionRegistry from '../../registries/FunctionRegistry'
import type { AnswerHistory } from '../runtime/answerHistory.type'
import type { StepValidationState } from '../runtime/evaluationState.type'
import type { StepValidityResult } from '../runtime/stepValidityResult.type'

/**
 * Per-request state shared by every compiled phase function.
 *
 * Holds the resolved answer history and journey-global `data` alongside the
 * request surfaces (session, params, query, request) that expressions read
 * against. `conditions` is the registry of authored functions (conditions,
 * transformers, generators, effects) that compiled expressions invoke by name.
 * Each answer carries only `current` here; phases that need parsed values or
 * mutation provenance widen this shape (see RenderCompilationContext,
 * AnswerPreparationContext).
 */
export interface BasePhaseContext {
  answers: Record<string, { current: unknown }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

/** Context for compiled field validation functions; carries no extra state beyond the base. */
export type ValidationContext = BasePhaseContext

/**
 * Runtime context passed to the compiled render function.
 * Field value resolution reads the AnswerHistory produced by compiled answer
 * preparation, including parsed values and mutation sources.
 */
export interface RenderCompilationContext {
  answers: Record<string, { current: unknown; parsed?: unknown; mutations?: { source: string; value: unknown }[] }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  post: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

/**
 * Runtime context passed to the compiled answer preparation function.
 *
 * Answer preparation mutates ctx.answers in place. That is intentional: hooks,
 * validation, reachability, and render all run against the same request context
 * and need to observe the same answer history.
 */
export interface AnswerPreparationContext {
  answers: Record<string, { current: unknown; mutations: { value: unknown; source: string }[] }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  post: Record<string, unknown>
}

/** Context for compiled entry-validation reachability predicates; carries no extra state beyond the base. */
export type ReachabilityContext = BasePhaseContext

/**
 * Context passed to compiled access and submit hook functions. Carries the
 * full per-request state a hook may read or mutate: answer histories, request
 * data, and the wiring a hook needs to run side effects and trigger validation.
 * Hooks mutate `answers` in place (each change appended to that answer's
 * mutation log) so the engine can later explain where a value came from.
 */
export interface HookLifecycleContext {
  answers: Record<string, AnswerHistory>
  data: Record<string, unknown>
  validation?: StepValidationState
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  /** Raw submitted form body, keyed by field name. */
  post: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  /** Opaque context handed to author-supplied effect functions invoked by hooks. */
  effectFunctionContext: unknown
  /**
   * Runs the named validation groups on demand from within a submit hook and
   * returns the outcome, allowing the hook to branch on validity before its
   * own result is decided. Absent for access hooks.
   */
  validate?: (groups: string[]) => StepValidityResult | Promise<StepValidityResult>
}
