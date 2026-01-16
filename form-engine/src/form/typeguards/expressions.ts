import { ValidationExpr } from '@form-engine/form/types/structures.type'
import { isPredicateExpr } from '@form-engine/form/typeguards/predicates'
import {
  ReferenceExpr,
  FormatExpr,
  PipelineExpr,
  ConditionalExpr,
  IterateExpr,
  MapIteratorConfig,
  FilterIteratorConfig,
  FindIteratorConfig,
  ValueExpr,
  NextExpr,
  RedirectOutcome,
  ThrowErrorOutcome,
  TransitionOutcome,
} from '../types/expressions.type'
import { ExpressionType, IteratorType, OutcomeType } from '../types/enums'
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
  return obj != null && obj.type === ExpressionType.CONDITIONAL
}

export function isIterateExpr(obj: any): obj is IterateExpr {
  return obj != null && obj.type === ExpressionType.ITERATE
}

export function isMapIteratorConfig(obj: any): obj is MapIteratorConfig {
  return obj != null && obj.type === IteratorType.MAP
}

export function isFilterIteratorConfig(obj: any): obj is FilterIteratorConfig {
  return obj != null && obj.type === IteratorType.FILTER
}

export function isFindIteratorConfig(obj: any): obj is FindIteratorConfig {
  return obj != null && obj.type === IteratorType.FIND
}

export function isNextExpr(obj: any): obj is NextExpr {
  return obj != null && obj.type === ExpressionType.NEXT
}

export function isRedirectOutcome(obj: any): obj is RedirectOutcome {
  return obj != null && obj.type === OutcomeType.REDIRECT
}

export function isThrowErrorOutcome(obj: any): obj is ThrowErrorOutcome {
  return obj != null && obj.type === OutcomeType.THROW_ERROR
}

export function isTransitionOutcome(obj: any): obj is TransitionOutcome {
  return isRedirectOutcome(obj) || isThrowErrorOutcome(obj)
}

export function isValueExpr(obj: any): obj is ValueExpr {
  // Check for complex expression types first
  if (isReferenceExpr(obj)) return true
  if (isFormatExpr(obj)) return true
  if (isPipelineExpr(obj)) return true
  if (isIterateExpr(obj)) return true

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
  return isReferenceExpr(node) ||
    isFormatExpr(node) ||
    isPipelineExpr(node) ||
    isConditionalExpr(node) ||
    isIterateExpr(node) ||
    isPredicateExpr(node) ||
    isFunctionExpr(node) ||
    isValidationExpr(node) ||
    isNextExpr(node)
}
