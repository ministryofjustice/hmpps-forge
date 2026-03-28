import {
  BaseFunctionExpr,
  ConditionFunctionExpr,
  TransformerFunctionExpr,
  EffectFunctionExpr,
  GeneratorFunctionExpr,
  FunctionExpr,
} from '../types/expressions.type'
import { FunctionType } from '../types/enums'

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

export function isGeneratorFunctionExpr(obj: any): obj is GeneratorFunctionExpr {
  return obj != null && obj.type === FunctionType.GENERATOR
}

export function isFunctionExpr(obj: any): obj is FunctionExpr<any> {
  return isBaseFunctionExpr(obj)
}
