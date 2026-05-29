import {
  ResolvableArray,
  ResolvableBoolean,
  ResolvableNumber,
  ResolvableString,
} from '../../components/types/structures.type'
import { isReferenceExpr, isPipelineExpr, isConditionalExpr } from './expressions'
import { isGeneratorFunctionExpr } from './functions'
import { isStringValue, isNumberValue, isBooleanValue, isArrayValue } from '../../shared/typeguards/primitives'

export function isResolvableString(obj: any): obj is ResolvableString {
  return isStringValue(obj) ||
    isReferenceExpr(obj) ||
    isPipelineExpr(obj) ||
    isConditionalExpr(obj) ||
    isGeneratorFunctionExpr(obj)
}

export function isResolvableBoolean(obj: any): obj is ResolvableBoolean {
  return isBooleanValue(obj) ||
    isReferenceExpr(obj) ||
    isPipelineExpr(obj) ||
    isConditionalExpr(obj) ||
    isGeneratorFunctionExpr(obj)
}

export function isResolvableNumber(obj: any): obj is ResolvableNumber {
  return isNumberValue(obj) ||
    isReferenceExpr(obj) ||
    isPipelineExpr(obj) ||
    isConditionalExpr(obj) ||
    isGeneratorFunctionExpr(obj)
}

export function isResolvableArray<T = any>(obj: any): obj is ResolvableArray<T> {
  return isArrayValue(obj) ||
    isReferenceExpr(obj) ||
    isPipelineExpr(obj) ||
    isConditionalExpr(obj) ||
    isGeneratorFunctionExpr(obj)
}
