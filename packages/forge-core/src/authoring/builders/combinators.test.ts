import { and, or, xor, not } from './combinators'
import { ConditionFunctionExpr, PredicateTestExpr } from '../types/expressions.type'
import { ConditionCombinatorType, FunctionType, PredicateType } from '../types/enums'

describe('Logic predicates', () => {
  // Helper to create a test predicate
  const testPredicate = (name: string, negate = false): PredicateTestExpr => ({
    type: PredicateType.TEST,
    subject: 'value',
    negate,
    condition: { type: FunctionType.CONDITION, name, arguments: [] as any },
  })

  // Helper to create a bare condition, which takes its subject from the surrounding match
  const testCondition = (name: string): ConditionFunctionExpr => ({
    type: FunctionType.CONDITION,
    name,
    arguments: [],
  })

  const mixedOperandsError = (fnName: string) =>
    `${fnName}() cannot mix bare conditions with predicates — conditions take their subject from the surrounding match`

  describe('and', () => {
    test('should create an AND logic predicate with two operands', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')

      const result = and(p1, p2)

      expect(result).toEqual({
        type: PredicateType.AND,
        operands: [p1, p2],
      })
    })

    test('should create an AND logic predicate with multiple operands', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')
      const p3 = testPredicate('test3')
      const p4 = testPredicate('test4')

      const result = and(p1, p2, p3, p4)

      expect(result).toEqual({
        type: PredicateType.AND,
        operands: [p1, p2, p3, p4],
      })
    })

    test('should handle nested logic predicates', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')
      const p3 = testPredicate('test3')

      const nested = or(p2, p3)
      const result = and(p1, nested)

      expect(result).toEqual({
        type: PredicateType.AND,
        operands: [p1, nested],
      })
    })

    test('should create an AND condition combinator when given bare conditions', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')

      const result = and(c1, c2)

      expect(result).toEqual({
        type: ConditionCombinatorType.AND,
        operands: [c1, c2],
      })
    })

    test('should create an AND condition combinator when given an array of bare conditions', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')
      const c3 = testCondition('cond3')

      const result = and([c1, c2, c3])

      expect(result).toEqual({
        type: ConditionCombinatorType.AND,
        operands: [c1, c2, c3],
      })
    })

    test('should throw error when bare conditions are mixed with predicates', () => {
      const c1 = testCondition('cond1')
      const p1 = testPredicate('test1')

      expect(() => and(c1, p1 as any)).toThrow(mixedOperandsError('and'))
    })
  })

  describe('or', () => {
    test('should create an OR logic predicate with two operands', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')

      const result = or(p1, p2)

      expect(result).toEqual({
        type: PredicateType.OR,
        operands: [p1, p2],
      })
    })

    test('should create an OR logic predicate with multiple operands', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')
      const p3 = testPredicate('test3')

      const result = or(p1, p2, p3)

      expect(result).toEqual({
        type: PredicateType.OR,
        operands: [p1, p2, p3],
      })
    })

    test('should handle nested logic predicates', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')
      const p3 = testPredicate('test3')

      const nested = and(p1, p2)
      const result = or(nested, p3)

      expect(result).toEqual({
        type: PredicateType.OR,
        operands: [nested, p3],
      })
    })

    test('should create an OR condition combinator when given bare conditions', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')

      const result = or(c1, c2)

      expect(result).toEqual({
        type: ConditionCombinatorType.OR,
        operands: [c1, c2],
      })
    })

    test('should create an OR condition combinator when given an array of bare conditions', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')

      const result = or([c1, c2])

      expect(result).toEqual({
        type: ConditionCombinatorType.OR,
        operands: [c1, c2],
      })
    })

    test('should throw error when bare conditions are mixed with predicates', () => {
      const c1 = testCondition('cond1')
      const p1 = testPredicate('test1')

      expect(() => or(c1, p1 as any)).toThrow(mixedOperandsError('or'))
    })
  })

  describe('xor', () => {
    test('should create an XOR logic predicate with two operands', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')

      const result = xor(p1, p2)

      expect(result).toEqual({
        type: PredicateType.XOR,
        operands: [p1, p2],
      })
    })

    test('should create an XOR logic predicate with multiple operands', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')
      const p3 = testPredicate('test3')
      const p4 = testPredicate('test4')

      const result = xor(p1, p2, p3, p4)

      expect(result).toEqual({
        type: PredicateType.XOR,
        operands: [p1, p2, p3, p4],
      })
    })

    test('should handle nested logic predicates', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')
      const p3 = testPredicate('test3')

      const nested = and(p2, p3)
      const result = xor(p1, nested)

      expect(result).toEqual({
        type: PredicateType.XOR,
        operands: [p1, nested],
      })
    })

    test('should create an XOR condition combinator when given bare conditions', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')

      const result = xor(c1, c2)

      expect(result).toEqual({
        type: ConditionCombinatorType.XOR,
        operands: [c1, c2],
      })
    })

    test('should create an XOR condition combinator when given an array of bare conditions', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')

      const result = xor([c1, c2])

      expect(result).toEqual({
        type: ConditionCombinatorType.XOR,
        operands: [c1, c2],
      })
    })

    test('should throw error when bare conditions are mixed with predicates', () => {
      const c1 = testCondition('cond1')
      const p1 = testPredicate('test1')

      expect(() => xor(c1, p1 as any)).toThrow(mixedOperandsError('xor'))
    })
  })

  describe('not', () => {
    test('should create a NOT logic predicate with single operand', () => {
      const p1 = testPredicate('test1')

      const result = not(p1)

      expect(result).toEqual({
        type: PredicateType.NOT,
        operand: p1,
      })
    })

    test('should handle nested logic predicates', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')

      const nested = and(p1, p2)
      const result = not(nested)

      expect(result).toEqual({
        type: PredicateType.NOT,
        operand: nested,
      })
    })

    test('should handle double negation', () => {
      const p1 = testPredicate('test1')

      const firstNot = not(p1)
      const doubleNot = not(firstNot)

      expect(doubleNot).toEqual({
        type: PredicateType.NOT,
        operand: firstNot,
      })
    })

    test('should create a NOT condition combinator when given a bare condition', () => {
      const c1 = testCondition('cond1')

      const result = not(c1)

      expect(result).toEqual({
        type: ConditionCombinatorType.NOT,
        operand: c1,
      })
    })

    test('should create a NOT condition combinator when given a nested condition combinator', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')

      const result = not(and(c1, c2))

      expect(result).toEqual({
        type: ConditionCombinatorType.NOT,
        operand: {
          type: ConditionCombinatorType.AND,
          operands: [c1, c2],
        },
      })
    })
  })

  describe('combinations', () => {
    test('should handle deeply nested logic predicates', () => {
      const p1 = testPredicate('test1')
      const p2 = testPredicate('test2')
      const p3 = testPredicate('test3')
      const p4 = testPredicate('test4')

      const result = and(or(p1, p2), not(xor(p3, p4)))

      expect(result).toEqual({
        type: PredicateType.AND,
        operands: [
          {
            type: PredicateType.OR,
            operands: [p1, p2],
          },
          {
            type: PredicateType.NOT,
            operand: {
              type: PredicateType.XOR,
              operands: [p3, p4],
            },
          },
        ],
      })
    })

    test('should handle mix of test predicates and logic predicates', () => {
      const t1 = testPredicate('test1')
      const t2 = testPredicate('test2', true) // negated test
      const t3 = testPredicate('test3')
      const t4 = testPredicate('test4')

      const complex = or(and(t1, t2), and(t3, t4))

      expect(complex).toEqual({
        type: PredicateType.OR,
        operands: [
          {
            type: PredicateType.AND,
            operands: [t1, t2],
          },
          {
            type: PredicateType.AND,
            operands: [t3, t4],
          },
        ],
      })
    })

    test('should handle all logic operators in one expression', () => {
      const p1 = testPredicate('p1')
      const p2 = testPredicate('p2')
      const p3 = testPredicate('p3')
      const p4 = testPredicate('p4')
      const p5 = testPredicate('p5')

      const complex = and(or(p1, p2), xor(p3, not(p4)), p5)

      expect(complex.type).toBe(PredicateType.AND)
      expect(complex.operands).toHaveLength(3)
      expect((complex.operands[0] as any).type).toBe(PredicateType.OR)
      expect((complex.operands[1] as any).type).toBe(PredicateType.XOR)
      expect((complex.operands[2] as any).type).toBe(PredicateType.TEST)
    })

    test('should handle nested condition combinators', () => {
      const c1 = testCondition('cond1')
      const c2 = testCondition('cond2')
      const c3 = testCondition('cond3')

      const result = or(and(c1, c2), not(c3))

      expect(result).toEqual({
        type: ConditionCombinatorType.OR,
        operands: [
          {
            type: ConditionCombinatorType.AND,
            operands: [c1, c2],
          },
          {
            type: ConditionCombinatorType.NOT,
            operand: c3,
          },
        ],
      })
    })
  })
})
