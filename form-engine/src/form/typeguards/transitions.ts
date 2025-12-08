import {
  LoadTransition,
  AccessTransition,
  ActionTransition,
  SkipValidationTransition,
  ValidatingTransition,
  SubmitTransition,
} from '../types/expressions.type'
import { TransitionType } from '../types/enums'

export function isLoadTransition(obj: any): obj is LoadTransition {
  return obj != null && obj.type === TransitionType.LOAD
}

export function isAccessTransition(obj: any): obj is AccessTransition {
  return obj != null && obj.type === TransitionType.ACCESS
}

export function isActionTransition(obj: any): obj is ActionTransition {
  return obj != null && obj.type === TransitionType.ACTION
}

export function isSkipValidationTransition(obj: any): obj is SkipValidationTransition {
  return obj != null && obj.type === TransitionType.SUBMIT && obj.validate === false
}

export function isValidatingTransition(obj: any): obj is ValidatingTransition {
  return obj != null && obj.type === TransitionType.SUBMIT && obj.validate === true
}

export function isSubmitTransition(obj: any): obj is SubmitTransition {
  return isSkipValidationTransition(obj) || isValidatingTransition(obj)
}

export function isTransition(obj: any): boolean {
  return isLoadTransition(obj) || isAccessTransition(obj) || isActionTransition(obj) || isSubmitTransition(obj)
}
