import { TieBreaker, ValidationExpr } from '../types/structures.type'
import { isPredicateExpr } from './predicates'
import { isConditionCombinatorExpr } from './conditionCombinators'
import {
  ReferenceExpr,
  PipelineExpr,
  ConditionalExpr,
  MatchExpr,
  IterateExpr,
  MapIteratorConfig,
  FilterIteratorConfig,
  FindIteratorConfig,
  ResolvableValue,
  RedirectOutcome,
  ThrowErrorOutcome,
  HookOutcome,
} from '../types/expressions.type'
import { ExpressionType, IteratorType, OutcomeType } from '../types/enums'
import { isFunctionExpr, isTransformerFunctionExpr, isGeneratorFunctionExpr } from './functions'

export function isReferenceExpr(obj: any): obj is ReferenceExpr {
  return obj != null && obj.type === ExpressionType.REFERENCE
}

export function isPipelineExpr(obj: any): obj is PipelineExpr {
  return obj != null && obj.type === ExpressionType.PIPELINE
}

export function isConditionalExpr(obj: any): obj is ConditionalExpr {
  return obj != null && obj.type === ExpressionType.CONDITIONAL
}

export function isMatchExpr(obj: any): obj is MatchExpr {
  return obj != null && obj.type === ExpressionType.MATCH
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

export function isRedirectOutcome(obj: any): obj is RedirectOutcome {
  return obj != null && obj.type === OutcomeType.REDIRECT
}

export function isThrowErrorOutcome(obj: any): obj is ThrowErrorOutcome {
  return obj != null && obj.type === OutcomeType.THROW_ERROR
}

export function isHookOutcome(obj: any): obj is HookOutcome {
  return isRedirectOutcome(obj) || isThrowErrorOutcome(obj)
}

export function isResolvableValue(obj: any): obj is ResolvableValue {
  // Check for complex expression types first
  if (isReferenceExpr(obj)) return true
  if (isPipelineExpr(obj)) return true
  if (isIterateExpr(obj)) return true

  // Check for function types
  if (obj != null && typeof obj === 'object' && 'type' in obj) {
    if (isTransformerFunctionExpr(obj)) return true
    if (isGeneratorFunctionExpr(obj)) return true
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

export function isTieBreaker(obj: any): obj is TieBreaker {
  return obj != null && obj.type === ExpressionType.TIE_BREAKER
}

export function isExpression(node: any): boolean {
  return isReferenceExpr(node) ||
    isPipelineExpr(node) ||
    isConditionalExpr(node) ||
    isMatchExpr(node) ||
    isIterateExpr(node) ||
    isPredicateExpr(node) ||
    isConditionCombinatorExpr(node) ||
    isFunctionExpr(node) ||
    isValidationExpr(node) ||
    isTieBreaker(node) ||
    isHookOutcome(node)
}
