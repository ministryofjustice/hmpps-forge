import type FunctionRegistry from '../../registries/FunctionRegistry'
import type { AnswerHistory } from './answerHistory.type'
import type { StepValidationState } from './evaluationState.type'
import type { StepValidityResult } from './stepValidityResult.type'

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
  post: Record<string, string | string[]>
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
