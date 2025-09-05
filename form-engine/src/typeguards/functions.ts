import {
  BaseFunctionExpr,
  ConditionFunctionExpr,
  TransformerFunctionExpr,
  EffectFunctionExpr,
  FunctionExpr,
} from '../form/types/expressions.type'
import { FunctionType } from '../form/types/enums'

export function isBaseFunctionExpr(obj: any): obj is BaseFunctionExpr<any> {
  return obj != null && Object.values(FunctionType).includes(obj.type)
}

export function isConditionFunctionExpr(obj: any): obj is ConditionFunctionExpr {
  return obj != null && obj.type === FunctionType.CONDITION
}

export function isTransformerFunctionExpr(obj: any): obj is TransformerFunctionExpr {
  return obj != null && obj.type === FunctionType.TRANSFORMER
}

export function isEffectFunctionExpr(obj: any): obj is EffectFunctionExpr {
  return obj != null && obj.type === FunctionType.EFFECT
}

export function isFunctionExpr(obj: any): obj is FunctionExpr<any> {
  return isBaseFunctionExpr(obj)
}
