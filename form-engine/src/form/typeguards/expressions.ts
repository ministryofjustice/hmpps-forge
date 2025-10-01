import { ValidationExpr } from '@form-engine/form/types/structures.type'
import { isPredicateExpr } from '@form-engine/form/typeguards/predicates'
import {
  ReferenceExpr,
  FormatExpr,
  PipelineExpr,
  ConditionalExpr,
  CollectionExpr,
  ValueExpr,
  NextExpr,
} from '../types/expressions.type'
import { ExpressionType, LogicType } from '../types/enums'
import { isFunctionExpr, isTransformerFunctionExpr } from './functions'

export function isReferenceExpr(obj: any): obj is ReferenceExpr {
  return obj != null && obj.type === ExpressionType.REFERENCE
}

export function isFormatExpr(obj: any): obj is FormatExpr {
  return obj != null && obj.type === ExpressionType.FORMAT
}

export function isPipelineExpr(obj: any): obj is PipelineExpr {
  return obj != null && obj.type === ExpressionType.PIPELINE
}

export function isConditionalExpr(obj: any): obj is ConditionalExpr {
  return obj != null && obj.type === LogicType.CONDITIONAL
}

export function isCollectionExpr(obj: any): obj is CollectionExpr {
  return obj != null && obj.type === ExpressionType.COLLECTION
}

export function isNextExpr(obj: any): obj is NextExpr {
  return obj != null && obj.type === ExpressionType.NEXT
}

export function isValueExpr(obj: any): obj is ValueExpr {
  // Check for complex expression types first
  if (isReferenceExpr(obj)) return true
  if (isFormatExpr(obj)) return true
  if (isPipelineExpr(obj)) return true
  if (isCollectionExpr(obj)) return true

  // Check for function types
  if (obj != null && typeof obj === 'object' && 'type' in obj) {
    if (isTransformerFunctionExpr(obj)) return true
    // TODO: probably add generator function here later
  }

  // Check for arrays
  if (Array.isArray(obj)) return true

  // Check for primitive types
  if (typeof obj === 'string') return true
  if (typeof obj === 'number') return true
  if (typeof obj === 'boolean') return true
  if (obj === null) return true

  // Check for plain objects (Record<string, any>)
  return typeof obj === 'object' && obj.constructor === Object
}

export function isValidationExpr(obj: any): obj is ValidationExpr {
  return obj != null && obj.type === ExpressionType.VALIDATION
}

export function isExpression(node: any): boolean {
  return (
    isReferenceExpr(node) ||
    isFormatExpr(node) ||
    isPipelineExpr(node) ||
    isConditionalExpr(node) ||
    isCollectionExpr(node) ||
    isPredicateExpr(node) ||
    isFunctionExpr(node) ||
    isValidationExpr(node) ||
    isNextExpr(node)
  )
}
