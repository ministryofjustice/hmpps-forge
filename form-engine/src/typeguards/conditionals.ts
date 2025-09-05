import {
  ConditionalString,
  ConditionalBoolean,
  ConditionalNumber,
  ConditionalArray,
} from '../form/types/structures.type'
import { isReferenceExpr, isFormatExpr, isPipelineExpr, isConditionalExpr } from './expressions'
import { isStringValue, isNumberValue, isBooleanValue, isArrayValue } from './primitives'

export function isConditionalString(obj: any): obj is ConditionalString {
  return (
    isStringValue(obj) || isReferenceExpr(obj) || isFormatExpr(obj) || isPipelineExpr(obj) || isConditionalExpr(obj)
  )
}

export function isConditionalBoolean(obj: any): obj is ConditionalBoolean {
  return isBooleanValue(obj) || isReferenceExpr(obj) || isPipelineExpr(obj) || isConditionalExpr(obj)
}

export function isConditionalNumber(obj: any): obj is ConditionalNumber {
  return isNumberValue(obj) || isReferenceExpr(obj) || isPipelineExpr(obj) || isConditionalExpr(obj)
}

export function isConditionalArray<T = any>(obj: any): obj is ConditionalArray<T> {
  return isArrayValue(obj) || isReferenceExpr(obj) || isPipelineExpr(obj) || isConditionalExpr(obj)
}
