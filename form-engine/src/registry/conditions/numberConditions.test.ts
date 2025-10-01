import { NumberConditions, NumberConditionsRegistry } from './numberConditions'
import { FunctionType } from '../../form/types/enums'

describe('NumberConditions', () => {
  describe('GreaterThan', () => {
    const { evaluate } = NumberConditionsRegistry.GreaterThan

    test('should return true when value is greater than threshold', () => {
      expect(evaluate(10, 5)).toBe(true)
      expect(evaluate(0, -1)).toBe(true)
      expect(evaluate(1.5, 1.4)).toBe(true)
    })

    test('should return false when value is equal to threshold', () => {
      expect(evaluate(5, 5)).toBe(false)
      expect(evaluate(0, 0)).toBe(false)
    })

    test('should return false when value is less than threshold', () => {
      expect(evaluate(3, 5)).toBe(false)
      expect(evaluate(-1, 0)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate('10', 5)).toThrow('Condition.Number.GreaterThan expects a number but received string')
      expect(() => evaluate(null, 5)).toThrow('Condition.Number.GreaterThan expects a number but received object')
      expect(() => evaluate(undefined, 5)).toThrow(
        'Condition.Number.GreaterThan expects a number but received undefined',
      )
      expect(() => evaluate(true, 5)).toThrow('Condition.Number.GreaterThan expects a number but received boolean')
      expect(() => evaluate({}, 5)).toThrow('Condition.Number.GreaterThan expects a number but received object')
      expect(() => evaluate(NaN, 5)).toThrow('Condition.Number.GreaterThan expects a number but received NaN')
    })

    test('should handle edge cases with Infinity and negative numbers', () => {
      expect(evaluate(Infinity, 1000)).toBe(true)
      expect(evaluate(-Infinity, 0)).toBe(false)
      expect(evaluate(0, -Infinity)).toBe(true)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.GreaterThan(5)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'GreaterThan',
        arguments: [5],
      })
    })
  })

  describe('GreaterThanOrEqual', () => {
    const { evaluate } = NumberConditionsRegistry.GreaterThanOrEqual

    test('should return true when value is greater than threshold', () => {
      expect(evaluate(10, 5)).toBe(true)
      expect(evaluate(1.6, 1.5)).toBe(true)
    })

    test('should return true when value is equal to threshold', () => {
      expect(evaluate(5, 5)).toBe(true)
      expect(evaluate(0, 0)).toBe(true)
      expect(evaluate(-10, -10)).toBe(true)
    })

    test('should return false when value is less than threshold', () => {
      expect(evaluate(3, 5)).toBe(false)
      expect(evaluate(-1, 0)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate('5', 5)).toThrow('Condition.Number.GreaterThanOrEqual expects a number but received string')
      expect(() => evaluate([], 5)).toThrow('Condition.Number.GreaterThanOrEqual expects a number but received object')
      expect(() => evaluate(NaN, 5)).toThrow('Condition.Number.GreaterThanOrEqual expects a number but received NaN')
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.GreaterThanOrEqual(10)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'GreaterThanOrEqual',
        arguments: [10],
      })
    })
  })

  describe('LessThan', () => {
    const { evaluate } = NumberConditionsRegistry.LessThan

    test('should return true when value is less than threshold', () => {
      expect(evaluate(3, 5)).toBe(true)
      expect(evaluate(-1, 0)).toBe(true)
      expect(evaluate(1.4, 1.5)).toBe(true)
    })

    test('should return false when value is equal to threshold', () => {
      expect(evaluate(5, 5)).toBe(false)
      expect(evaluate(0, 0)).toBe(false)
    })

    test('should return false when value is greater than threshold', () => {
      expect(evaluate(10, 5)).toBe(false)
      expect(evaluate(0, -1)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate('3', 5)).toThrow('Condition.Number.LessThan expects a number but received string')
      expect(() => evaluate(NaN, 5)).toThrow('Condition.Number.LessThan expects a number but received NaN')
    })

    test('should handle edge cases with Infinity', () => {
      expect(evaluate(-Infinity, 0)).toBe(true)
      expect(evaluate(0, Infinity)).toBe(true)
      expect(evaluate(Infinity, Infinity)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.LessThan(7)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'LessThan',
        arguments: [7],
      })
    })
  })

  describe('LessThanOrEqual', () => {
    const { evaluate } = NumberConditionsRegistry.LessThanOrEqual

    test('should return true when value is less than threshold', () => {
      expect(evaluate(3, 5)).toBe(true)
      expect(evaluate(-10, -5)).toBe(true)
    })

    test('should return true when value is equal to threshold', () => {
      expect(evaluate(5, 5)).toBe(true)
      expect(evaluate(0, 0)).toBe(true)
      expect(evaluate(-7, -7)).toBe(true)
    })

    test('should return false when value is greater than threshold', () => {
      expect(evaluate(10, 5)).toBe(false)
      expect(evaluate(0, -1)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate(false, 5)).toThrow('Condition.Number.LessThanOrEqual expects a number but received boolean')
      expect(() => evaluate(NaN, 5)).toThrow('Condition.Number.LessThanOrEqual expects a number but received NaN')
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.LessThanOrEqual(3)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'LessThanOrEqual',
        arguments: [3],
      })
    })
  })

  describe('Between', () => {
    const { evaluate } = NumberConditionsRegistry.Between

    test('should return true when value is between min and max (inclusive)', () => {
      expect(evaluate(5, 1, 10)).toBe(true)
      expect(evaluate(1, 1, 10)).toBe(true)
      expect(evaluate(10, 1, 10)).toBe(true)
      expect(evaluate(0, -5, 5)).toBe(true)
    })

    test('should return false when value is outside the range', () => {
      expect(evaluate(0, 1, 10)).toBe(false)
      expect(evaluate(11, 1, 10)).toBe(false)
      expect(evaluate(-6, -5, 5)).toBe(false)
    })

    test('should handle decimal values', () => {
      expect(evaluate(5.5, 5.0, 6.0)).toBe(true)
      expect(evaluate(5.0, 5.0, 6.0)).toBe(true)
      expect(evaluate(6.0, 5.0, 6.0)).toBe(true)
      expect(evaluate(4.9, 5.0, 6.0)).toBe(false)
      expect(evaluate(6.1, 5.0, 6.0)).toBe(false)
    })

    test('should handle negative ranges', () => {
      expect(evaluate(-5, -10, -1)).toBe(true)
      expect(evaluate(-10, -10, -1)).toBe(true)
      expect(evaluate(-1, -10, -1)).toBe(true)
      expect(evaluate(0, -10, -1)).toBe(false)
    })

    test('should handle single-point range', () => {
      expect(evaluate(5, 5, 5)).toBe(true)
      expect(evaluate(4, 5, 5)).toBe(false)
      expect(evaluate(6, 5, 5)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate('5', 1, 10)).toThrow('Condition.Number.Between expects a number but received string')
      expect(() => evaluate(null, 1, 10)).toThrow('Condition.Number.Between expects a number but received object')
      expect(() => evaluate(undefined, 1, 10)).toThrow(
        'Condition.Number.Between expects a number but received undefined',
      )
      expect(() => evaluate(NaN, 1, 10)).toThrow('Condition.Number.Between expects a number but received NaN')
    })

    test('should handle inverted ranges (max < min)', () => {
      expect(evaluate(5, 10, 1)).toBe(false)
      expect(evaluate(5, 10, 5)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.Between(1, 10)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Between',
        arguments: [1, 10],
      })
    })
  })
})
