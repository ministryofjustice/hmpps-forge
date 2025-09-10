import { isJourneyDefinition, isStepDefinition, isBlockDefinition } from '@form-engine/typeguards/structures'
import { isExpression } from '@form-engine/typeguards/expressions'
import { isTransition } from '@form-engine/typeguards/transitions'
import ASTTransformationError from '@form-engine/errors/ASTTransformationError'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import {
  transformBlock,
  transformJourney,
  transformStep,
} from '@form-engine/core/ast/transformer/transforms/transformStructures'
import { transformExpression } from '@form-engine/core/ast/transformer/transforms/transformExpressions'
import { transformTransition } from '@form-engine/core/ast/transformer/transforms/transformTransitions'
import { ASTNode } from '../types/nodes.type'

/**
 * Main entry point for transformation
 * Sets up error boundary and initiates recursive transformation
 */
export function transformToAst(json: any): ASTNode {
  // Path tracks location in JSON tree for error reporting
  const path: string[] = []

  try {
    return transformNode(json, path)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    // Wrap unknown errors with transformation context
    throw new ASTTransformationError({
      message: 'Failed to transform JSON to AST',
      path,
      node: json,
      cause: error as Error,
    })
  }
}

/**
 * Central dispatcher: Detects node type and routes to appropriate transformer
 * Uses typeguards to identify structures, expressions, and transitions
 */
export function transformNode(json: any, path: string[]): ASTNode {
  if (!json || typeof json !== 'object') {
    throw new InvalidNodeError({
      message: `Invalid node: expected object, got ${typeof json}`,
      path,
      node: json,
      expected: 'object',
      actual: typeof json,
    })
  }

  // Journey: Top-level form flow container
  if (isJourneyDefinition(json)) {
    return transformJourney(json, path)
  }

  // Step: Individual page in a journey
  if (isStepDefinition(json)) {
    return transformStep(json, path)
  }

  // Block: UI component (field, composite, collection)
  if (isBlockDefinition(json)) {
    return transformBlock(json, path)
  }

  // Expressions: References, conditionals, pipelines, functions
  if (isExpression(json)) {
    return transformExpression(json, path)
  }

  // Transitions: Lifecycle hooks (load, access, submit)
  if (isTransition(json)) {
    return transformTransition(json, path)
  }

  throw new UnknownNodeTypeError({
    nodeType: json?.type,
    path,
    node: json,
    validTypes: ['Journey', 'Step', 'Block', 'Expression', 'Transition'],
  })
}

/**
 * Transform properties: Convert object to Map with recursive transformation
 * Enables efficient property access and modification in AST
 */
export function transformProperties(obj: any, path: string[]): Map<string, ASTNode | any> {
  const properties = new Map<string, ASTNode | any>()

  for (const [key, value] of Object.entries(obj)) {
    const propPath = [...path, key]
    const transformedValue = transformValue(value, propPath)

    properties.set(key, transformedValue)
  }

  return properties
}

/**
 * Transform value: Recursive processor for any JSON value
 * Detects and transforms nested nodes while preserving primitives
 */
export function transformValue(value: any, path: string[]): any {
  // Preserve null/undefined as-is
  if (value === null || value === undefined) {
    return value
  }

  // Primitives (string, number, boolean) pass through
  if (typeof value !== 'object') {
    return value
  }

  // Arrays: Transform each element recursively
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      // Recursively transform each array item
      return transformValue(item, [...path, index.toString()])
    })
  }

  // Detect AST nodes and transform them
  if (isNode(value)) {
    return transformNode(value, path)
  }

  // Plain objects: Recursively check properties for nested nodes
  // Critical for finding blocks inside component properties
  const result: any = {}

  for (const [key, val] of Object.entries(value)) {
    result[key] = transformValue(val, [...path, key])
  }

  return result
}

/**
 * Node detection: Identifies objects that are AST nodes
 * Nodes have a 'type' field and match known patterns
 */
export function isNode(value: any): boolean {
  // Must be an object
  if (!value || typeof value !== 'object') {
    return false
  }

  // Arrays are not nodes (but may contain nodes)
  if (Array.isArray(value)) {
    return false
  }

  // Nodes must have a string type field
  if (!value.type || typeof value.type !== 'string') {
    return false
  }

  // Check against all known node types
  return (
    isJourneyDefinition(value) ||
    isStepDefinition(value) ||
    isBlockDefinition(value) ||
    isExpression(value) ||
    isTransition(value)
  )
}
