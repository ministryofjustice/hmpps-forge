import { AccessTransition, ActionTransition, SubmitTransition } from '../types/expressions.type'
import { TransitionType } from '../types/enums'

export function isAccessTransition(obj: any): obj is AccessTransition {
  return obj != null && obj.type === TransitionType.ACCESS
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
