import { ASTNodeType } from '../../../contracts/ast/enums'
import { PredicateType } from '../../../../authoring/types/enums'
import {
  PredicateAndExpr,
  PredicateNotExpr,
  PredicateOrExpr,
  PredicateTestExpr,
  PredicateXorExpr,
} from '../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../errors/InvalidNodeError'
import {
  AndPredicateASTNode,
  NotPredicateASTNode,
  OrPredicateASTNode,
  PredicateASTNode,
  TestPredicateASTNode,
  XorPredicateASTNode,
} from '../../../contracts/ast/predicates.type'
import type { NodeBuildContext } from './NodeFactory'

type PredicateNaryExpr = PredicateAndExpr | PredicateOrExpr | PredicateXorExpr
type NaryPredicateASTNode = AndPredicateASTNode | OrPredicateASTNode | XorPredicateASTNode

const NARY_PREDICATE_NAMES = {
  [PredicateType.AND]: 'And',
  [PredicateType.OR]: 'Or',
  [PredicateType.XOR]: 'Xor',
} as const

/**
 * Test: subject.condition with optional negation
 * Defaults: negate = false
 */
export function createTestPredicateNode(json: PredicateTestExpr, ctx: NodeBuildContext): TestPredicateASTNode {
  if (!json.subject) {
    throw new InvalidNodeError({
      message: 'Test predicate requires a subject',
      node: json,
      expected: 'subject property',
      actual: 'undefined',
    })
  }

  if (!json.condition) {
    throw new InvalidNodeError({
      message: 'Test predicate requires a condition',
      node: json,
      expected: 'condition property',
      actual: 'undefined',
    })
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.TEST,
    properties: {
      // Use transformValue to support both AST nodes and literals
      subject: ctx.transformValue(json.subject),
      condition: ctx.createNode(json.condition),
      negate: json.negate ?? false,
    },
  }
}

/**
 * Not: Single operand negation
 */
export function createNotPredicateNode(json: PredicateNotExpr, ctx: NodeBuildContext): NotPredicateASTNode {
  if (!json.operand) {
    throw new InvalidNodeError({
      message: 'Not predicate requires an operand',
      node: json,
      expected: 'operand property',
      actual: 'undefined',
    })
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.NOT,
    properties: {
      operand: ctx.createNode(json.operand),
    },
  }
}

/**
 * And/Or/Xor: Multiple operands combined by the given predicate type.
 * The three n-ary predicates only differ by their discriminant, so one
 * parameterised creator covers all of them.
 */
export function naryPredicateCreator(
  predicateType: PredicateType.AND | PredicateType.OR | PredicateType.XOR,
): (json: PredicateNaryExpr, ctx: NodeBuildContext) => NaryPredicateASTNode {
  return (json, ctx) => {
    if (!json.operands || !Array.isArray(json.operands) || json.operands.length === 0) {
      throw new InvalidNodeError({
        message: `${NARY_PREDICATE_NAMES[predicateType]} predicate requires a non-empty operands array`,
        node: json,
        expected: 'operands array with at least one element',
        actual: json.operands ? `array with ${json.operands.length} elements` : 'undefined',
      })
    }

    return {
      id: ctx.nextId(),
      type: ASTNodeType.PREDICATE,
      predicateType,
      properties: {
        operands: json.operands.map((operand: unknown) => ctx.createNode(operand)) as PredicateASTNode[],
      },
    } as NaryPredicateASTNode
  }
}
