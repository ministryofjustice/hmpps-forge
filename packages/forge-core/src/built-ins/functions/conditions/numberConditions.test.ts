import { NumberConditions, numberConditionsRegistry } from './numberConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('NumberConditions', () => {
  const harness = new FunctionRegistryTestHarness(numberConditionsRegistry)

  describe('IsNumber', () => {
    test('should return true for valid numbers', () => {
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(0)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(42)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(-5)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(3.14)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(Infinity)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(-Infinity)).toBe(true)
    })

    test('should return false for NaN', () => {
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(NaN)).toBe(false)
    })

    test('should return false for non-numbers', () => {
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput('42')).toBe(false)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput('')).toBe(false)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(null)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(undefined)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput(true)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput({})).toBe(false)
      expect(harness.evaluate(NumberConditions.IsNumber()).withInput([])).toBe(false)
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
    test('should return true for integers', () => {
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(0)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(42)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(-5)).toBe(true)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(1000000)).toBe(true)
    })

    test('should return false for floats', () => {
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(3.14)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(0.5)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(-2.7)).toBe(false)
    })

    test('should return false for NaN and Infinity', () => {
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(NaN)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(Infinity)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(-Infinity)).toBe(false)
    })

    test('should return false for non-numbers', () => {
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput('42')).toBe(false)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput('')).toBe(false)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(null)).toBe(false)
      expect(harness.evaluate(NumberConditions.IsInteger()).withInput(undefined)).toBe(false)
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
    test('should return true when value is greater than threshold', () => {
      expect(harness.evaluate(NumberConditions.GreaterThan(5)).withInput(10)).toBe(true)
      expect(harness.evaluate(NumberConditions.GreaterThan(-1)).withInput(0)).toBe(true)
      expect(harness.evaluate(NumberConditions.GreaterThan(1.4)).withInput(1.5)).toBe(true)
    })

    test('should return false when value is equal to threshold', () => {
      expect(harness.evaluate(NumberConditions.GreaterThan(5)).withInput(5)).toBe(false)
      expect(harness.evaluate(NumberConditions.GreaterThan(0)).withInput(0)).toBe(false)
    })

    test('should return false when value is less than threshold', () => {
      expect(harness.evaluate(NumberConditions.GreaterThan(5)).withInput(3)).toBe(false)
      expect(harness.evaluate(NumberConditions.GreaterThan(0)).withInput(-1)).toBe(false)
    })

    test('should handle edge cases with Infinity and negative numbers', () => {
      // An Infinity value fails the numberSchema inputSchema (Zod z.number() rejects
      // non-finite numbers), so the condition soft-fails to false rather than comparing.
      expect(harness.evaluate(NumberConditions.GreaterThan(1000)).withInput(Infinity)).toBe(false)
      expect(harness.evaluate(NumberConditions.GreaterThan(0)).withInput(-Infinity)).toBe(false)
      // An Infinity config argument fails the argumentsSchema, which is an author mistake and throws.
      expect(() => harness.evaluate(NumberConditions.GreaterThan(-Infinity)).withInput(0)).toThrow(TypeError)
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
    test('should return true when value is greater than threshold', () => {
      expect(harness.evaluate(NumberConditions.GreaterThanOrEqual(5)).withInput(10)).toBe(true)
      expect(harness.evaluate(NumberConditions.GreaterThanOrEqual(1.5)).withInput(1.6)).toBe(true)
    })

    test('should return true when value is equal to threshold', () => {
      expect(harness.evaluate(NumberConditions.GreaterThanOrEqual(5)).withInput(5)).toBe(true)
      expect(harness.evaluate(NumberConditions.GreaterThanOrEqual(0)).withInput(0)).toBe(true)
      expect(harness.evaluate(NumberConditions.GreaterThanOrEqual(-10)).withInput(-10)).toBe(true)
    })

    test('should return false when value is less than threshold', () => {
      expect(harness.evaluate(NumberConditions.GreaterThanOrEqual(5)).withInput(3)).toBe(false)
      expect(harness.evaluate(NumberConditions.GreaterThanOrEqual(0)).withInput(-1)).toBe(false)
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
    test('should return true when value is less than threshold', () => {
      expect(harness.evaluate(NumberConditions.LessThan(5)).withInput(3)).toBe(true)
      expect(harness.evaluate(NumberConditions.LessThan(0)).withInput(-1)).toBe(true)
      expect(harness.evaluate(NumberConditions.LessThan(1.5)).withInput(1.4)).toBe(true)
    })

    test('should return false when value is equal to threshold', () => {
      expect(harness.evaluate(NumberConditions.LessThan(5)).withInput(5)).toBe(false)
      expect(harness.evaluate(NumberConditions.LessThan(0)).withInput(0)).toBe(false)
    })

    test('should return false when value is greater than threshold', () => {
      expect(harness.evaluate(NumberConditions.LessThan(5)).withInput(10)).toBe(false)
      expect(harness.evaluate(NumberConditions.LessThan(-1)).withInput(0)).toBe(false)
    })

    test('should handle edge cases with Infinity', () => {
      // A -Infinity value fails the numberSchema inputSchema, so the condition soft-fails to false.
      expect(harness.evaluate(NumberConditions.LessThan(0)).withInput(-Infinity)).toBe(false)
      // An Infinity config argument fails the argumentsSchema, which is an author mistake and throws.
      expect(() => harness.evaluate(NumberConditions.LessThan(Infinity)).withInput(0)).toThrow(TypeError)
      expect(() => harness.evaluate(NumberConditions.LessThan(Infinity)).withInput(Infinity)).toThrow(TypeError)
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
    test('should return true when value is less than threshold', () => {
      expect(harness.evaluate(NumberConditions.LessThanOrEqual(5)).withInput(3)).toBe(true)
      expect(harness.evaluate(NumberConditions.LessThanOrEqual(-5)).withInput(-10)).toBe(true)
    })

    test('should return true when value is equal to threshold', () => {
      expect(harness.evaluate(NumberConditions.LessThanOrEqual(5)).withInput(5)).toBe(true)
      expect(harness.evaluate(NumberConditions.LessThanOrEqual(0)).withInput(0)).toBe(true)
      expect(harness.evaluate(NumberConditions.LessThanOrEqual(-7)).withInput(-7)).toBe(true)
    })

    test('should return false when value is greater than threshold', () => {
      expect(harness.evaluate(NumberConditions.LessThanOrEqual(5)).withInput(10)).toBe(false)
      expect(harness.evaluate(NumberConditions.LessThanOrEqual(-1)).withInput(0)).toBe(false)
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
    test('should return true when value is between min and max (inclusive)', () => {
      expect(harness.evaluate(NumberConditions.Between(1, 10)).withInput(5)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(1, 10)).withInput(1)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(1, 10)).withInput(10)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(-5, 5)).withInput(0)).toBe(true)
    })

    test('should return false when value is outside the range', () => {
      expect(harness.evaluate(NumberConditions.Between(1, 10)).withInput(0)).toBe(false)
      expect(harness.evaluate(NumberConditions.Between(1, 10)).withInput(11)).toBe(false)
      expect(harness.evaluate(NumberConditions.Between(-5, 5)).withInput(-6)).toBe(false)
    })

    test('should handle decimal values', () => {
      expect(harness.evaluate(NumberConditions.Between(5.0, 6.0)).withInput(5.5)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(5.0, 6.0)).withInput(5.0)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(5.0, 6.0)).withInput(6.0)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(5.0, 6.0)).withInput(4.9)).toBe(false)
      expect(harness.evaluate(NumberConditions.Between(5.0, 6.0)).withInput(6.1)).toBe(false)
    })

    test('should handle negative ranges', () => {
      expect(harness.evaluate(NumberConditions.Between(-10, -1)).withInput(-5)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(-10, -1)).withInput(-10)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(-10, -1)).withInput(-1)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(-10, -1)).withInput(0)).toBe(false)
    })

    test('should handle single-point range', () => {
      expect(harness.evaluate(NumberConditions.Between(5, 5)).withInput(5)).toBe(true)
      expect(harness.evaluate(NumberConditions.Between(5, 5)).withInput(4)).toBe(false)
      expect(harness.evaluate(NumberConditions.Between(5, 5)).withInput(6)).toBe(false)
    })

    test('should handle inverted ranges (max < min)', () => {
      expect(harness.evaluate(NumberConditions.Between(10, 1)).withInput(5)).toBe(false)
      expect(harness.evaluate(NumberConditions.Between(10, 5)).withInput(5)).toBe(false)
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
