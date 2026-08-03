import { finaliseBuilders } from './utils/finaliseBuilders'
import { TieBreaker, TieBreakerProps, ValidationExpr, ValidationProps } from '../types/structures.type'
import { AccessHook, RedirectOutcome, SubmitHook, ThrowErrorOutcome } from '../types/expressions.type'
import { ExpressionType, HookType, OutcomeType } from '../types/enums'

/**
 * Creates a submission hook for handling form submissions.
 * Use this in the onSubmission array of steps.
 */
export function submit(definition: Omit<SubmitHook, 'type'>): SubmitHook {
  return finaliseBuilders({ ...definition, type: HookType.SUBMIT }) as SubmitHook
}

/**
 * Creates an access hook for access control, data loading, and analytics.
 * Use this in the onAccess array of journeys or steps.
 */
export function access(definition: Omit<AccessHook, 'type'>): AccessHook {
  return finaliseBuilders({ ...definition, type: HookType.ACCESS }) as AccessHook
}

/**
 * Creates a validation rule for a field or step.
 * Add to the `validWhen` array - rules are checked in order.
 */
export function validation(definition: ValidationProps): ValidationExpr {
  return finaliseBuilders({
    ...definition,
    type: ExpressionType.VALIDATION,
  }) as ValidationExpr
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
  return finaliseBuilders({
    ...definition,
    type: ExpressionType.TIE_BREAKER,
  }) as TieBreaker
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
export function redirect(definition: Omit<RedirectOutcome, 'type'>): RedirectOutcome {
  return finaliseBuilders({
    ...definition,
    type: OutcomeType.REDIRECT,
  }) as RedirectOutcome
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
export function throwError(definition: Omit<ThrowErrorOutcome, 'type'>): ThrowErrorOutcome {
  return finaliseBuilders({
    ...definition,
    type: OutcomeType.THROW_ERROR,
  }) as ThrowErrorOutcome
}
