import {
  LoadTransition,
  AccessTransition,
  SkipValidationTransition,
  ValidatingTransition,
  SubmitTransition,
} from '../form/types/expressions.type'
import { TransitionType } from '../form/types/enums'

export function isLoadTransition(obj: any): obj is LoadTransition {
  return obj != null && obj.type === TransitionType.LOAD
}

export function isAccessTransition(obj: any): obj is AccessTransition {
  return obj != null && obj.type === TransitionType.ACCESS
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
