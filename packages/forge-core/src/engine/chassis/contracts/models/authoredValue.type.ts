import type { IteratorType, PredicateType } from '../../../../shared/taxonomy'
import type { ASTNode } from '../ast/ast.type'
import { ASTNodeFamily, astNodeFamily } from '../ast/enums'
import { isASTNode } from '../ast/nodes'

/** Analysis is the only boundary that reads expression AST structure. */
export enum AuthoredValueKind {
  STATIC = 'static',
  REFERENCE = 'reference',
  FUNCTION = 'function',
  PIPELINE = 'pipeline',
  PREDICATE = 'predicate',
  NULLISH = 'nullish',
  CONDITIONAL = 'conditional',
  MATCH = 'match',
  ITERATION = 'iteration',
  VALIDATION = 'validation',
  RECORD = 'record',
  LIST = 'list',
  BLOCK = 'block',
}

export type AuthoredValue = StaticValue | ExpressionValue | RecordValue | ListValue | BlockValue
export type ExpressionValue =
  | ReferenceValue
  | FunctionValue
  | PipelineValue
  | PredicateValue
  | NullishValue
  | ConditionalValue
  | MatchValue
  | IterationValue
  | ValidationValue

export interface StaticValue {
  readonly kind: AuthoredValueKind.STATIC
  readonly value: unknown
}

export interface ReferenceValue {
  readonly kind: AuthoredValueKind.REFERENCE
  readonly source: ASTNode
  readonly path: readonly (string | number | AuthoredValue)[]
  readonly base?: AuthoredValue
}

export interface FunctionValue {
  readonly kind: AuthoredValueKind.FUNCTION
  readonly source: ASTNode
  readonly name: string
  readonly arguments: readonly AuthoredValue[]
}

export interface PipelineValue {
  readonly kind: AuthoredValueKind.PIPELINE
  readonly source: ASTNode
  readonly input: AuthoredValue
  readonly steps: readonly FunctionValue[]
}

export interface PredicateValue {
  readonly kind: AuthoredValueKind.PREDICATE
  readonly source: ASTNode
  readonly predicate: PredicateType
  readonly subject?: AuthoredValue
  readonly condition?: FunctionValue
  readonly negate: boolean
  readonly operands: readonly AuthoredValue[]
  readonly operand: AuthoredValue
}

export interface NullishValue {
  readonly kind: AuthoredValueKind.NULLISH
  readonly source: ASTNode
  readonly input: AuthoredValue
  readonly fallback: AuthoredValue
}

export interface ConditionalValue {
  readonly kind: AuthoredValueKind.CONDITIONAL
  readonly source: ASTNode
  readonly predicate: AuthoredValue
  readonly thenValue: AuthoredValue
  readonly elseValue: AuthoredValue
}

export enum MatchBranchKind {
  CASE = 'case',
  PREDICATE = 'predicate',
}

export interface MatchValue {
  readonly kind: AuthoredValueKind.MATCH
  readonly source: ASTNode
  readonly subject: AuthoredValue
  readonly branches: readonly MatchBranchValue[]
  readonly otherwise?: AuthoredValue
}

export type MatchBranchValue =
  | {
      readonly kind: MatchBranchKind.CASE
      readonly expected: AuthoredValue
      readonly value: AuthoredValue
    }
  | {
      readonly kind: MatchBranchKind.PREDICATE
      readonly predicate: AuthoredValue
      readonly value: AuthoredValue
    }

export interface IterationValue {
  readonly kind: AuthoredValueKind.ITERATION
  readonly source: ASTNode
  readonly iterator?: IteratorType
  readonly input: AuthoredValue
  readonly yieldTemplate?: AuthoredValue
  readonly predicate?: AuthoredValue
}

export interface ValidationValue {
  readonly kind: AuthoredValueKind.VALIDATION
  readonly source: ASTNode
  readonly function?: AuthoredValue
  readonly condition?: AuthoredValue
  readonly message: AuthoredValue
  readonly details?: AuthoredValue
  readonly submissionOnly: boolean
  readonly groups?: AuthoredValue
}

export interface RecordValue {
  readonly kind: AuthoredValueKind.RECORD
  readonly entries: readonly RecordEntryValue[]
}

export interface RecordEntryValue {
  readonly key: string
  readonly value: AuthoredValue
}

export interface ListValue {
  readonly kind: AuthoredValueKind.LIST
  readonly items: readonly AuthoredValue[]
}

/** Only resolve supplies the operation that turns a component into work. */
export interface BlockValue {
  readonly kind: AuthoredValueKind.BLOCK
  readonly source: ASTNode | Record<string, unknown>
  readonly variant: string
  readonly blockType: string
  readonly id?: string
  readonly entries: readonly RecordEntryValue[]
}

/** A node the expression dispatcher can compile — AST or template. */
export function isExpressionLeaf(value: unknown): value is ASTNode {
  return isASTNode(value)
}

export function staticValue(value: unknown): StaticValue {
  return { kind: AuthoredValueKind.STATIC, value }
}

/**
 * Whether a value contains no expression, template, or block nodes anywhere,
 * so it can be emitted as one literal. The single definition of "static"
 * shared by the classifier and the expression dispatcher.
 */
export function isDeepStaticValue(value: unknown): boolean {
  if (value === null || value === undefined || typeof value !== 'object') {
    return true
  }

  if (isExpressionLeaf(value) || isBlockShapedValue(value)) {
    return false
  }

  if (Array.isArray(value)) {
    return value.every(item => isDeepStaticValue(item))
  }

  return Object.values(value).every(item => isDeepStaticValue(item))
}

/** A template block node or a block-shaped plain object. */
export function isBlockShapedValue(value: unknown): boolean {
  if (isASTNode(value)) {
    return astNodeFamily(value.kind) === ASTNodeFamily.COMPONENT_CALL
  }

  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>

  return typeof record.variant === 'string' && typeof record.blockType === 'string'
}
