import {
  PredicateTestExpr,
  PredicateAndExpr,
  PredicateOrExpr,
  PredicateXorExpr,
  PredicateNotExpr,
  PredicateExpr,
} from '../types/expressions.type'
import { PredicateType } from '../types/enums'

export function isPredicateTestExpr(obj: any): obj is PredicateTestExpr {
  return obj != null && obj.type === PredicateType.TEST
}

export function isPredicateAndExpr(obj: any): obj is PredicateAndExpr {
  return obj != null && obj.type === PredicateType.AND
}

export function isPredicateOrExpr(obj: any): obj is PredicateOrExpr {
  return obj != null && obj.type === PredicateType.OR
}

export function isPredicateXorExpr(obj: any): obj is PredicateXorExpr {
  return obj != null && obj.type === PredicateType.XOR
}

export function isPredicateNotExpr(obj: any): obj is PredicateNotExpr {
  return obj != null && obj.type === PredicateType.NOT
}

export function isPredicateExpr(obj: any): obj is PredicateExpr {
  return isPredicateTestExpr(obj) ||
    isPredicateAndExpr(obj) ||
    isPredicateOrExpr(obj) ||
    isPredicateXorExpr(obj) ||
    isPredicateNotExpr(obj)
}
