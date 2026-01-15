import { AccessTransition, ActionTransition, SubmitTransition } from '../types/expressions.type'
import { TransitionType } from '../types/enums'

/** Type for AccessTransition with redirect (navigates to another page) */
type AccessTransitionRedirect = AccessTransition & { redirect: any[] }

/** Type for AccessTransition with error response (returns HTTP status) */
type AccessTransitionError = AccessTransition & { status: number; message: any }

export function isAccessTransition(obj: any): obj is AccessTransition {
  return obj != null && obj.type === TransitionType.ACCESS
}

/**
 * Checks if an AccessTransition has a redirect configured.
 * Use this to narrow AccessTransition to the redirect variant.
 */
export function isAccessTransitionRedirect(obj: AccessTransition): obj is AccessTransitionRedirect {
  return 'redirect' in obj && Array.isArray(obj.redirect)
}

/**
 * Checks if an AccessTransition has an error response configured.
 * Use this to narrow AccessTransition to the error variant.
 */
export function isAccessTransitionError(obj: AccessTransition): obj is AccessTransitionError {
  return 'status' in obj && typeof obj.status === 'number'
}

export function isActionTransition(obj: any): obj is ActionTransition {
  return obj != null && obj.type === TransitionType.ACTION
}

export function isSubmitTransition(obj: any): obj is SubmitTransition {
  return obj != null && obj.type === TransitionType.SUBMIT
}

export function isTransition(obj: any): boolean {
  return isAccessTransition(obj) || isActionTransition(obj) || isSubmitTransition(obj)
}
