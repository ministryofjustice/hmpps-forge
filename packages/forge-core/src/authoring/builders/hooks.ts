import { captureCallsite, stampCallsite } from './utils/captureCallsite'
import { TieBreaker, TieBreakerProps, ValidationExpr, ValidationProps } from '../types/structures.type'
import { AccessHook, RedirectOutcome, SubmitHook, ThrowErrorOutcome } from '../types/expressions.type'
import { HookType, PolicyType } from '../../shared/taxonomy'

/**
 * Creates a submission hook for handling form submissions.
 * Use this in the onSubmission array of steps.
 */
export function submit(definition: Omit<SubmitHook, '_forge'>): SubmitHook {
  const result = { ...definition, _forge: HookType.SUBMIT } as SubmitHook
  stampCallsite(result, captureCallsite(submit))
  return result
}

/**
 * Creates an access hook for access control, data loading, and analytics.
 * Use this in the onAccess array of journeys or steps.
 */
export function access(definition: Omit<AccessHook, '_forge'>): AccessHook {
  const result = { ...definition, _forge: HookType.ACCESS } as AccessHook
  stampCallsite(result, captureCallsite(access))
  return result
}

/**
 * Creates a validation rule for a field or step.
 * Add to the `validWhen` array - rules are checked in order.
 */
export function validation(definition: ValidationProps): ValidationExpr {
  const result = {
    ...definition,
    _forge: PolicyType.VALIDATION_RULE,
  } as ValidationExpr
  stampCallsite(result, captureCallsite(validation))
  return result
}

/**
 * Creates a tie-breaker rule for a step. Add to `reachability.tieBreakers` —
 * entries are evaluated top-to-bottom and the first matching `when` (or an
 * entry with no `when`) supplies the step's priority.
 *
 * @example
 * tieBreaker({ priority: 100, when: Answer('income_started').match(true) })
 */
export function tieBreaker(definition: TieBreakerProps): TieBreaker {
  const result = {
    ...definition,
    _forge: PolicyType.NAVIGATION_TIE_BREAKER,
  } as TieBreaker
  stampCallsite(result, captureCallsite(tieBreaker))
  return result
}

/**
 * Creates a redirect outcome for hooks.
 * When matched, halts hook processing and redirects to the specified path.
 *
 * @example
 * // Unconditional redirect
 * redirect({ goto: '/overview' })
 *
 * @example
 * // Conditional redirect
 * redirect({
 *   when: Data('needsSetup').match(Condition.Equals(true)),
 *   goto: '/setup',
 * })
 */
export function redirect(definition: Omit<RedirectOutcome, '_forge'>): RedirectOutcome {
  const result = {
    ...definition,
    _forge: PolicyType.OUTCOME_REDIRECT,
  } as RedirectOutcome
  stampCallsite(result, captureCallsite(redirect))
  return result
}

/**
 * Creates an error outcome for hooks.
 * When matched, halts hook processing and returns an error outcome.
 *
 * @example
 * // Not found error
 * throwError({
 *   when: Data('notFound').match(Condition.Equals(true)),
 *   status: 404,
 *   message: 'Item not found',
 * })
 *
 * @example
 * // Dynamic error message
 * throwError({
 *   when: Data('saveError').match(Condition.IsRequired()),
 *   status: 500,
 *   message: Format('Failed to save: %1', Data('saveError')),
 * })
 */
export function throwError(definition: Omit<ThrowErrorOutcome, '_forge'>): ThrowErrorOutcome {
  const result = {
    ...definition,
    _forge: PolicyType.OUTCOME_THROW_ERROR,
  } as ThrowErrorOutcome
  stampCallsite(result, captureCallsite(throwError))
  return result
}
