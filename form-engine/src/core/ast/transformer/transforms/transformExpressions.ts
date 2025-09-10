import {
  ASTNode,
  ConditionalASTNode,
  ExpressionASTNode,
  FunctionASTNode,
  PipelineASTNode,
  PredicateASTNode,
  ReferenceASTNode,
  ValidationASTNode,
} from '@form-engine/core/ast/types/nodes.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, LogicType } from '@form-engine/form/types/enums'
import { transformNode, transformValue } from '@form-engine/core/ast/transformer/transformToAst'
import {
  isPredicateAndExpr,
  isPredicateExpr,
  isPredicateNotExpr,
  isPredicateOrExpr,
  isPredicateTestExpr,
  isPredicateXorExpr,
} from '@form-engine/typeguards/predicates'
import {
  isConditionalExpr,
  isPipelineExpr,
  isReferenceExpr,
  isValidationExpr,
} from '@form-engine/typeguards/expressions'
import { isFunctionExpr } from '@form-engine/typeguards/functions'

/**
 * Transform Expression node: Dynamic values and logic
 * Handles references, pipelines, conditionals, validations, predicates, functions
 */
export function transformExpression(json: any, path: string[]): ExpressionASTNode {
  // Handle reference expressions
  if (isReferenceExpr(json)) {
    return transformReference(json, path)
  }

  // Handle pipeline expressions
  if (isPipelineExpr(json)) {
    return transformPipeline(json, path)
  }

  // Handle conditional expressions
  if (isConditionalExpr(json)) {
    return transformConditional(json, path)
  }

  // Handle validation expressions
  if (isValidationExpr(json)) {
    return transformValidation(json, path)
  }

  // Handle predicate expressions
  if (isPredicateExpr(json)) {
    return transformPredicate(json, path)
  }

  // Handle function expressions
  if (isFunctionExpr(json)) {
    return transformFunction(json, path)
  }

  // Fallback: Unknown expression types preserved as generic nodes
  const { type, ...dataProperties } = json
  const properties = new Map<string, ASTNode | any>()

  for (const [key, value] of Object.entries(dataProperties)) {
    properties.set(key, transformValue(value, [...path, key]))
  }

  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: json.type,
    properties,
    raw: json,
  }
}

/**
 * Transform Reference expression: Points to data in context
 * Examples: Answer('field'), Data('external.value'), Self(), Item()
 */
export function transformReference(json: any, _path: string[]): ReferenceASTNode {
  const properties = new Map<string, ASTNode | any>()

  // Path segments for data resolution (e.g., ['answers', 'email'])
  properties.set('path', json.path)

  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    properties,
    raw: json,
  }
}

/**
 * Transform Pipeline expression: Sequential data transformations
 * Input flows through each step: input -> step1 -> step2 -> output
 */
export function transformPipeline(json: any, path: string[]): PipelineASTNode {
  const properties = new Map<string, ASTNode | any>()

  // Initial value to transform
  properties.set('input', transformNode(json.input, [...path, 'input']))

  // Transform each pipeline step
  const steps = json.steps.map((step: any, i: number) => {
    const result: any = {
      name: step.name,
    }

    // Optional arguments for transformer functions
    if (step.args) {
      result.args = step.args.map((arg: any, j: number) =>
        transformValue(arg, [...path, 'steps', i.toString(), 'args', j.toString()]),
      )
    }

    return result
  })

  properties.set('steps', steps)

  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.PIPELINE,
    properties,
    raw: json,
  }
}

/**
 * Transform Conditional expression: If-then-else logic
 * Evaluates predicate to choose between two values
 */
export function transformConditional(json: any, path: string[]): ConditionalASTNode {
  const properties = new Map<string, ASTNode | any>()

  if (json.predicate) {
    properties.set('predicate', transformNode(json.predicate, [...path, 'predicate']))
  }

  if (json.then !== undefined) {
    properties.set('thenValue', transformValue(json.then, [...path, 'then']))
  }

  if (json.else !== undefined) {
    properties.set('elseValue', transformValue(json.else, [...path, 'else']))
  }

  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: LogicType.CONDITIONAL,
    properties,
    raw: json,
  }
}

/**
 * Transform Validation expression: Field validation rules
 * Contains predicate condition and error message
 */
export function transformValidation(json: any, path: string[]): ValidationASTNode {
  const properties = new Map<string, ASTNode | any>()

  if (json.when) {
    properties.set('when', transformNode(json.when, [...path, 'when']))
  }

  properties.set('message', json.message || '')

  if (json.submissionOnly !== undefined) {
    properties.set('submissionOnly', json.submissionOnly)
  }

  if (json.details) {
    properties.set('details', json.details)
  }

  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.VALIDATION,
    properties,
    raw: json,
  }
}

/**
 * Transform Predicate expression: Boolean logic operators
 * Handles TEST, AND, OR, XOR, NOT operations
 */
export function transformPredicate(json: any, path: string[]): PredicateASTNode {
  const predicateType = json.type
  const properties = new Map<string, ASTNode | any>()

  // TEST: subject.condition with optional negation
  if (isPredicateTestExpr(json)) {
    properties.set('subject', transformNode(json.subject, [...path, 'subject']))
    properties.set('negate', json.negate)
    properties.set('condition', transformNode(json.condition, [...path, 'condition']))
  } else if (isPredicateNotExpr(json)) {
    // NOT: Single operand negation
    properties.set('operand', transformNode(json.operand, [...path, 'operand']))
  } else if (isPredicateAndExpr(json) || isPredicateOrExpr(json) || isPredicateXorExpr(json)) {
    // AND/OR/XOR: Multiple operands (min 2)
    const operands = json.operands.map((operand: any, i: number) =>
      transformNode(operand, [...path, 'operands', i.toString()]),
    )

    properties.set('operands', operands)
  }

  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: predicateType,
    properties,
    raw: json,
  }
}

/**
 * Transform Function expression: Registered function calls
 * Types: Condition (boolean), Transformer (value), Effect (side-effect)
 */
export function transformFunction(json: any, path: string[]): FunctionASTNode {
  const funcType = json.type
  const properties = new Map<string, ASTNode | any>()

  properties.set('name', json.name)

  // Transform arguments recursively
  const args = json.arguments.map((arg: any, i: number) => transformValue(arg, [...path, 'arguments', i.toString()]))

  properties.set('arguments', args)

  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: funcType,
    properties,
    raw: json,
  }
}
