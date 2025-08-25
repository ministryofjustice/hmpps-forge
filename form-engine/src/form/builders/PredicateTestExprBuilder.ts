import {
  ConditionFunctionExpr,
  PredicateExpr,
  PredicateAndExpr,
  PredicateOrExpr,
  PredicateXorExpr,
  PredicateNotExpr,
  PredicateTestExpr,
  ValueExpr,
} from '../types/expressions.type'
import { LogicType } from '../types/enums'

/**
 * Fluent builder for creating predicate test expressions.
 * Allows chaining of negation and condition matching against a subject value.
 */
export class PredicateTestExprBuilder {
  private readonly subject: ValueExpr

  private negateNext = false

  constructor(subject: ValueExpr) {
    this.subject = subject
  }

  /**
   * Negates the next condition test.
   * Can be chained: `value(ref).not.match(condition)`
   */
  get not(): this {
    this.negateNext = !this.negateNext
    return this
  }

  private buildTest(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    const test: PredicateTestExpr = {
      type: LogicType.TEST,
      subject: this.subject,
      negate: this.negateNext,
      condition,
    }
    this.negateNext = false
    return test
  }

  /**
   * Creates a test predicate that checks if the subject matches the given condition.
   * @param condition - The condition function to test against
   * @returns A predicate test expression
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    return this.buildTest(condition)
  }
}

/**
 * Converts a predicate input to a resolved predicate expression.
 * Ensures PredicateBuilder instances have called .match() before use.
 */
function resolvePredicate(p: PredicateExpr | PredicateTestExprBuilder | PredicateTestExpr): PredicateExpr {
  if (p instanceof PredicateTestExprBuilder) {
    throw new Error('PredicateBuilder must call .match() before use')
  }
  return p
}

/**
 * Creates an AND logic predicate where all operands must be true.
 * @param p - Two or more predicate expressions to combine
 * @returns A logic predicate that evaluates to true if all operands are true
 */
export const and = (...p: readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]]): PredicateAndExpr => {
  const resolved = p.map(resolvePredicate)
  return {
    type: LogicType.AND,
    operands: resolved as unknown as readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]],
  }
}

/**
 * Creates an OR logic predicate where at least one operand must be true.
 * @param p - Two or more predicate expressions to combine
 * @returns A logic predicate that evaluates to true if any operand is true
 */
export const or = (...p: readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]]): PredicateOrExpr => {
  const resolved = p.map(resolvePredicate)
  return {
    type: LogicType.OR,
    operands: resolved as unknown as readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]],
  }
}

/**
 * Creates an XOR logic predicate where exactly one operand must be true.
 * @param p - Two or more predicate expressions to combine
 * @returns A logic predicate that evaluates to true if exactly one operand is true
 */
export const xor = (...p: readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]]): PredicateXorExpr => {
  const resolved = p.map(resolvePredicate)
  return {
    type: LogicType.XOR,
    operands: resolved as unknown as readonly [PredicateExpr, PredicateExpr, ...PredicateExpr[]],
  }
}

/**
 * Creates a NOT logic predicate that inverts the operand's result.
 * @param p - The predicate expression to negate
 * @returns A logic predicate that evaluates to the opposite of the operand
 */
export const not = (p: PredicateExpr): PredicateNotExpr => {
  return {
    type: LogicType.NOT,
    operand: resolvePredicate(p),
  }
}
