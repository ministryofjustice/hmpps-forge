import { PredicateTestExprBuilder, and, or, xor, not } from './PredicateTestExprBuilder'
import { ValueExpr, ConditionFunctionExpr, PredicateTestExpr } from '../types/expressions.type'
import { FunctionType, PredicateType } from '../types/enums'

describe('PredicateTestExprBuilder', () => {
  // Helper function to create a mock condition
  const mockCondition = (name: string): ConditionFunctionExpr<any> => ({
    type: FunctionType.CONDITION,
    name,
    arguments: [],
  })

  // Helper function to create a mock value
  const mockValue = (value: any): ValueExpr => value

  describe('constructor', () => {
    test('should create a builder with the given subject', () => {
      const subject = mockValue('test')
      const builder = new PredicateTestExprBuilder(subject)

      const result = builder.match(mockCondition('isRequired'))
      expect(result.subject).toBe(subject)
    })
  })

  describe('match', () => {
    test('should create a basic test expression', () => {
      const subject = mockValue('test')
      const condition = mockCondition('isRequired')
      const builder = new PredicateTestExprBuilder(subject)

      const result = builder.match(condition)

      expect(result).toEqual({
        type: PredicateType.TEST,
        subject,
        negate: false,
        condition,
      })
    })

    test('should work with different subject types', () => {
      const subjects = [
        mockValue('string'),
        mockValue(123),
        mockValue(true),
        mockValue(null),
        mockValue(undefined),
        mockValue(['array']),
        mockValue({ object: true }),
      ]

      subjects.forEach(subject => {
        const builder = new PredicateTestExprBuilder(subject)
        const result = builder.match(mockCondition('test'))

        expect(result.subject).toBe(subject)
        expect(result.type).toBe(PredicateType.TEST)
      })
    })

    test('should work with different condition types', () => {
      const subject = mockValue('test')
      const conditions = [
        mockCondition('isRequired'),
        mockCondition('equals'),
        mockCondition('greaterThan'),
        { type: FunctionType.CONDITION, name: 'complex', arguments: [1, 'two', true] } as ConditionFunctionExpr<any>,
      ]

      conditions.forEach(condition => {
        const builder = new PredicateTestExprBuilder(subject)
        const result = builder.match(condition)

        expect(result.condition).toBe(condition)
        expect(result.type).toBe(PredicateType.TEST)
      })
    })
  })

  describe('not', () => {
    test('should negate the next condition', () => {
      const subject = mockValue('test')
      const condition = mockCondition('isRequired')
      const builder = new PredicateTestExprBuilder(subject)

      const result = builder.not.match(condition)

      expect(result).toEqual({
        type: PredicateType.TEST,
        subject,
        negate: true,
        condition,
      })
    })

    // Note: I'm not sure why anyone would do this anyway...
    test('should handle double negation', () => {
      const subject = mockValue('test')
      const condition = mockCondition('isRequired')
      const builder = new PredicateTestExprBuilder(subject)

      const result = builder.not.not.match(condition)

      expect(result).toEqual({
        type: PredicateType.TEST,
        subject,
        negate: false,
        condition,
      })
    })

    test('should return the same builder instance for chaining', () => {
      const subject = mockValue('test')
      const builder = new PredicateTestExprBuilder(subject)

      const notBuilder = builder.not

      expect(notBuilder).toBe(builder)
    })
  })

  describe('arguments handling', () => {
    test('should handle empty condition arguments', () => {
      const subject = mockValue('test')
      const condition: ConditionFunctionExpr<any> = {
        type: FunctionType.CONDITION,
        name: 'isRequired',
        arguments: [],
      }

      const builder = new PredicateTestExprBuilder(subject)
      const result = builder.match(condition)

      expect(result.condition).toEqual(condition)
    })

    test('should handle conditions with complex arguments', () => {
      const subject = mockValue('test')
      const condition: ConditionFunctionExpr<any> = {
        type: FunctionType.CONDITION,
        name: 'complex',
        arguments: [123, 'string', true, null, undefined, [1, 2, 3], { nested: { deep: 'value' } }],
      }

      const builder = new PredicateTestExprBuilder(subject)
      const result = builder.match(condition)

      expect(result.condition).toEqual(condition)
    })
  })
})

describe('Logic predicates', () => {
  // Helper to create a test predicate
  const testPredicate = (name: string, negate = false): PredicateTestExpr => ({
    type: PredicateType.TEST,
    subject: 'value',
    negate,
    condition: { type: FunctionType.CONDITION, name, arguments: [] as any },
  })

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

    test('should throw error if PredicateTestExprBuilder is passed without calling match()', () => {
      const p1 = testPredicate('test1')
      const builder = new PredicateTestExprBuilder('value')

      expect(() => and(p1, builder as any)).toThrow('PredicateBuilder must call .match() before use')
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

    test('should throw error if PredicateTestExprBuilder is passed without calling match()', () => {
      const p1 = testPredicate('test1')
      const builder = new PredicateTestExprBuilder('value')

      expect(() => or(p1, builder as any)).toThrow('PredicateBuilder must call .match() before use')
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

    test('should throw error if PredicateTestExprBuilder is passed without calling match()', () => {
      const p1 = testPredicate('test1')
      const builder = new PredicateTestExprBuilder('value')

      expect(() => xor(p1, builder as any)).toThrow('PredicateBuilder must call .match() before use')
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

    test('should throw error if PredicateTestExprBuilder is passed without calling match()', () => {
      const builder = new PredicateTestExprBuilder('value')

      expect(() => not(builder as any)).toThrow('PredicateBuilder must call .match() before use')
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
  })
})
