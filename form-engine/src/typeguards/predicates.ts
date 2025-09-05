import {
  PredicateTestExpr,
  PredicateAndExpr,
  PredicateOrExpr,
  PredicateXorExpr,
  PredicateNotExpr,
  PredicateExpr,
} from '../form/types/expressions.type'
import { LogicType } from '../form/types/enums'

export function isPredicateTestExpr(obj: any): obj is PredicateTestExpr {
  return obj != null && obj.type === LogicType.TEST
}

export function isPredicateAndExpr(obj: any): obj is PredicateAndExpr {
  return obj != null && obj.type === LogicType.AND
}

export function isPredicateOrExpr(obj: any): obj is PredicateOrExpr {
  return obj != null && obj.type === LogicType.OR
}

export function isPredicateXorExpr(obj: any): obj is PredicateXorExpr {
  return obj != null && obj.type === LogicType.XOR
}

export function isPredicateNotExpr(obj: any): obj is PredicateNotExpr {
  return obj != null && obj.type === LogicType.NOT
}

export function isPredicateExpr(obj: any): obj is PredicateExpr {
  return (
    isPredicateTestExpr(obj) ||
    isPredicateAndExpr(obj) ||
    isPredicateOrExpr(obj) ||
    isPredicateXorExpr(obj) ||
    isPredicateNotExpr(obj)
  )
}
