import {
  ConditionAndExpr,
  ConditionOrExpr,
  ConditionXorExpr,
  ConditionNotExpr,
  ConditionCombinatorExpr,
} from '../types/expressions.type'
import { ConditionCombinatorType } from '../types/enums'

export function isConditionAndExpr(obj: any): obj is ConditionAndExpr {
  return obj != null && obj.type === ConditionCombinatorType.AND
}

export function isConditionOrExpr(obj: any): obj is ConditionOrExpr {
  return obj != null && obj.type === ConditionCombinatorType.OR
}

export function isConditionXorExpr(obj: any): obj is ConditionXorExpr {
  return obj != null && obj.type === ConditionCombinatorType.XOR
}

export function isConditionNotExpr(obj: any): obj is ConditionNotExpr {
  return obj != null && obj.type === ConditionCombinatorType.NOT
}

export function isConditionCombinatorExpr(obj: any): obj is ConditionCombinatorExpr {
  return isConditionAndExpr(obj) || isConditionOrExpr(obj) || isConditionXorExpr(obj) || isConditionNotExpr(obj)
}
