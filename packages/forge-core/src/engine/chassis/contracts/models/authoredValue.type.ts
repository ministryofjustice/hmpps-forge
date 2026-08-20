import type { IteratorType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../ast/enums'
import type { ASTNode } from '../ast/ast.type'
import { isASTNode, isTemplateNode } from '../ast/nodes'
import type { TemplateNode } from '../ast/template.type'

/**
 * The classified forms an authored value can take once analysis has finished
 * with it. Built by `AuthoredValueClassifier` in the analysis stage, consumed
 * by `RuntimeValueCompiler` and the phase compilers. Past analysis there is no
 * structural AST querying: AST nodes survive only as expression leaves (handed
 * to the expression dispatcher) and diagnostic tokens.
 */
export enum AuthoredValueKind {
  STATIC = 'static',
  EXPRESSION = 'expression',
  CONDITIONAL = 'conditional',
  MATCH = 'match',
  ITERATION = 'iteration',
  RECORD = 'record',
  LIST = 'list',
  BLOCK = 'block',
}

export type AuthoredValue =
  | StaticValue
  | ExpressionValue
  | ConditionalValue
  | MatchValue
  | IterationValue
  | RecordValue
  | ListValue
  | BlockValue

/** A deeply static value, emitted as a literal. */
export interface StaticValue {
  readonly kind: AuthoredValueKind.STATIC
  readonly value: unknown
}

/** An authored value that must be evaluated at request time. */
export interface ExpressionValue {
  readonly kind: AuthoredValueKind.EXPRESSION
  readonly node: ASTNode | TemplateNode
}

/** A predicate choosing between two authored values. */
export interface ConditionalValue {
  readonly kind: AuthoredValueKind.CONDITIONAL
  /** The conditional node itself — expression leaf and diagnostic token. */
  readonly source: ASTNode | TemplateNode
  readonly predicate: AuthoredValue
  readonly thenValue: AuthoredValue
  readonly elseValue: AuthoredValue
}

/** First-matching-predicate selection over authored branch values. */
export interface MatchValue {
  readonly kind: AuthoredValueKind.MATCH
  /** The match node itself — expression leaf and diagnostic token. */
  readonly source: ASTNode | TemplateNode
  readonly branches: readonly MatchBranchValue[]
  /** Present only when the author supplied an otherwise value. */
  readonly otherwise?: AuthoredValue
}

export interface MatchBranchValue {
  readonly predicate: AuthoredValue
  readonly value: AuthoredValue
}

/** A MAP/FILTER/FIND iteration producing a value from an input collection. */
export interface IterationValue {
  readonly kind: AuthoredValueKind.ITERATION
  /** The iterate node itself — expression leaf and diagnostic token. */
  readonly source: ASTNode | TemplateNode
  /** `undefined` for unrecognised iterator kinds, which materialise as `undefined`. */
  readonly iterator?: IteratorType
  readonly input: AuthoredValue
  /** MAP only; a MAP without a yield template materialises `undefined` items. */
  readonly yieldTemplate?: AuthoredValue
  /** FILTER and FIND predicates. */
  readonly predicate?: AuthoredValue
}

/** A record with at least one non-static entry, materialised key by key. */
export interface RecordValue {
  readonly kind: AuthoredValueKind.RECORD
  readonly entries: readonly RecordEntryValue[]
}

export interface RecordEntryValue {
  readonly key: string
  readonly value: AuthoredValue
}

/** An array with at least one non-static item, materialised item by item. */
export interface ListValue {
  readonly kind: AuthoredValueKind.LIST
  readonly items: readonly AuthoredValue[]
}

/**
 * A nested block — a template block node or a block-shaped plain object.
 * Classification is generic AST knowledge, but only the resolve concern knows
 * how to emit one (its runtime-value policy supplies the block compiler);
 * every other concern treats a block value as an impossible state.
 */
export interface BlockValue {
  readonly kind: AuthoredValueKind.BLOCK
  /** The block node or block-shaped object — diagnostic and identity token. */
  readonly source: TemplateNode | Record<string, unknown>
  readonly variant: string
  readonly blockType: string
  /** Registered block id; template blocks derive an instance id at runtime. */
  readonly id?: string
  /** The block's classified properties, in authored order. */
  readonly entries: readonly RecordEntryValue[]
}

/** A node the expression dispatcher can compile — AST or template. */
export function isExpressionLeaf(value: unknown): value is ASTNode | TemplateNode {
  return isASTNode(value) || isTemplateNode(value)
}

export function expressionValue(node: ASTNode | TemplateNode): ExpressionValue {
  return { kind: AuthoredValueKind.EXPRESSION, node }
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
  if (isTemplateNode(value)) {
    return value.originalType === ASTNodeType.BLOCK
  }

  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>

  return record.type === ASTNodeType.BLOCK && typeof record.variant === 'string' && typeof record.blockType === 'string'
}

/**
 * Reconstructs the raw authored value for operand positions — the expression
 * dispatcher's `compileOperandCode` owns static/node dispatch there, so the
 * classified tree hands back exactly what the author wrote. Node-backed arms
 * return their source node; classification is lossless.
 */
export function toRawOperand(value: AuthoredValue): unknown {
  switch (value.kind) {
    case AuthoredValueKind.STATIC:
      return value.value
    case AuthoredValueKind.EXPRESSION:
      return value.node
    case AuthoredValueKind.CONDITIONAL:
    case AuthoredValueKind.MATCH:
    case AuthoredValueKind.ITERATION:
      return value.source
    case AuthoredValueKind.BLOCK:
      return value.source
    case AuthoredValueKind.LIST:
      return value.items.map(item => toRawOperand(item))
    case AuthoredValueKind.RECORD:
      return Object.fromEntries(value.entries.map(entry => [entry.key, toRawOperand(entry.value)]))
    default:
      return undefined
  }
}
