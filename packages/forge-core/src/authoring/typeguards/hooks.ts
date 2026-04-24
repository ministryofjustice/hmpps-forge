import { AccessHook, SubmitHook } from '../types/expressions.type'
import { HookType } from '../types/enums'

export function isAccessHook(obj: any): obj is AccessHook {
  return obj != null && obj.type === HookType.ACCESS
}

export function isSubmitHook(obj: any): obj is SubmitHook {
  return obj != null && obj.type === HookType.SUBMIT
}

export function isHook(obj: any): boolean {
  return isAccessHook(obj) || isSubmitHook(obj)
}
