import {
  FunctionExpr,
  PredicateExpr,
  PredicateLogicExpr,
  PredicateTestExpr,
  ValueExpr,
} from '../types/expressions.type'

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

  private buildTest(condition: FunctionExpr<any>): PredicateTestExpr {
    const test = {
      type: 'test' as const,
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
  match(condition: FunctionExpr<any>): PredicateTestExpr {
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
 * Creates a logic predicate expression with the specified operator and operands.
 */
function logic(
  op: PredicateLogicExpr['op'],
  operands: readonly [PredicateExpr, ...PredicateExpr[]],
): PredicateLogicExpr {
  return {
    type: 'logic',
    op,
    operands: operands.map(resolvePredicate),
  }
}

/**
 * Creates an AND logic predicate where all operands must be true.
 * @param p - Two or more predicate expressions to combine
 * @returns A logic predicate that evaluates to true if all operands are true
 */
export const and = (...p: readonly [PredicateExpr, ...PredicateExpr[]]): PredicateLogicExpr => {
  return logic('and', p)
}

/**
 * Creates an OR logic predicate where at least one operand must be true.
 * @param p - Two or more predicate expressions to combine
 * @returns A logic predicate that evaluates to true if any operand is true
 */
export const or = (...p: readonly [PredicateExpr, ...PredicateExpr[]]): PredicateLogicExpr => {
  return logic('or', p)
}

/**
 * Creates an XOR logic predicate where exactly one operand must be true.
 * @param p - Two or more predicate expressions to combine
 * @returns A logic predicate that evaluates to true if exactly one operand is true
 */
export const xor = (...p: readonly [PredicateExpr, ...PredicateExpr[]]): PredicateLogicExpr => {
  return logic('xor', p)
}

/**
 * Creates a NOT logic predicate that inverts the operand's result.
 * @param p - The predicate expression to negate
 * @returns A logic predicate that evaluates to the opposite of the operand
 */
export const not = (p: PredicateExpr): PredicateLogicExpr => {
  return logic('not', [p])
}
