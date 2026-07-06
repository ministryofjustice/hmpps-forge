import { NumberConditions, numberConditionsRegistry } from './numberConditions'
import { FunctionType } from '../types/enums'

describe('NumberConditions', () => {
  const registry = numberConditionsRegistry.build()

  describe('IsNumber', () => {
    const { evaluate } = registry['Number.IsNumber']

    test('should return true for valid numbers', () => {
      expect(evaluate(0)).toBe(true)
      expect(evaluate(42)).toBe(true)
      expect(evaluate(-5)).toBe(true)
      expect(evaluate(3.14)).toBe(true)
      expect(evaluate(Infinity)).toBe(true)
      expect(evaluate(-Infinity)).toBe(true)
    })

    test('should return false for NaN', () => {
      expect(evaluate(NaN)).toBe(false)
    })

    test('should return false for non-numbers', () => {
      expect(evaluate('42')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate(null)).toBe(false)
      expect(evaluate(undefined)).toBe(false)
      expect(evaluate(true)).toBe(false)
      expect(evaluate({})).toBe(false)
      expect(evaluate([])).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.IsNumber()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Number.IsNumber',
        arguments: [],
      })
    })
  })

  describe('IsInteger', () => {
    const { evaluate } = registry['Number.IsInteger']

    test('should return true for integers', () => {
      expect(evaluate(0)).toBe(true)
      expect(evaluate(42)).toBe(true)
      expect(evaluate(-5)).toBe(true)
      expect(evaluate(1000000)).toBe(true)
    })

    test('should return false for floats', () => {
      expect(evaluate(3.14)).toBe(false)
      expect(evaluate(0.5)).toBe(false)
      expect(evaluate(-2.7)).toBe(false)
    })

    test('should return false for NaN and Infinity', () => {
      expect(evaluate(NaN)).toBe(false)
      expect(evaluate(Infinity)).toBe(false)
      expect(evaluate(-Infinity)).toBe(false)
    })

    test('should return false for non-numbers', () => {
      expect(evaluate('42')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate(null)).toBe(false)
      expect(evaluate(undefined)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.IsInteger()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Number.IsInteger',
        arguments: [],
      })
    })
  })

  describe('GreaterThan', () => {
    const { evaluate } = registry['Number.GreaterThan']

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

    test('should handle edge cases with Infinity and negative numbers', () => {
      expect(evaluate(Infinity, 1000)).toBe(true)
      expect(evaluate(-Infinity, 0)).toBe(false)
      expect(evaluate(0, -Infinity)).toBe(true)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.GreaterThan(5)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Number.GreaterThan',
        arguments: [5],
      })
    })
  })

  describe('GreaterThanOrEqual', () => {
    const { evaluate } = registry['Number.GreaterThanOrEqual']

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

    test('should build correct expression object', () => {
      const expr = NumberConditions.GreaterThanOrEqual(10)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Number.GreaterThanOrEqual',
        arguments: [10],
      })
    })
  })

  describe('LessThan', () => {
    const { evaluate } = registry['Number.LessThan']

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

    test('should handle edge cases with Infinity', () => {
      expect(evaluate(-Infinity, 0)).toBe(true)
      expect(evaluate(0, Infinity)).toBe(true)
      expect(evaluate(Infinity, Infinity)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.LessThan(7)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Number.LessThan',
        arguments: [7],
      })
    })
  })

  describe('LessThanOrEqual', () => {
    const { evaluate } = registry['Number.LessThanOrEqual']

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

    test('should build correct expression object', () => {
      const expr = NumberConditions.LessThanOrEqual(3)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Number.LessThanOrEqual',
        arguments: [3],
      })
    })
  })

  describe('Between', () => {
    const { evaluate } = registry['Number.Between']

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

    test('should handle inverted ranges (max < min)', () => {
      expect(evaluate(5, 10, 1)).toBe(false)
      expect(evaluate(5, 10, 5)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = NumberConditions.Between(1, 10)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Number.Between',
        arguments: [1, 10],
      })
    })
  })
})
