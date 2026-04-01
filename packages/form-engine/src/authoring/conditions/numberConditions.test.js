Object.defineProperty(exports, '__esModule', { value: true })
const numberConditions_1 = require('./numberConditions')
const defineFunction_1 = require('../utils/defineFunction')
const enums_1 = require('../types/enums')

describe('NumberConditions', function () {
  const registry = (0, defineFunction_1.createFunctionsRegistry)(numberConditions_1.NumberConditionsImplementations)
  describe('IsNumber', function () {
    const evaluate = registry.IsNumber.evaluate
    test('should return true for valid numbers', function () {
      expect(evaluate(0)).toBe(true)
      expect(evaluate(42)).toBe(true)
      expect(evaluate(-5)).toBe(true)
      expect(evaluate(3.14)).toBe(true)
      expect(evaluate(Infinity)).toBe(true)
      expect(evaluate(-Infinity)).toBe(true)
    })
    test('should return false for NaN', function () {
      expect(evaluate(NaN)).toBe(false)
    })
    test('should return false for non-numbers', function () {
      expect(evaluate('42')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate(null)).toBe(false)
      expect(evaluate(undefined)).toBe(false)
      expect(evaluate(true)).toBe(false)
      expect(evaluate({})).toBe(false)
      expect(evaluate([])).toBe(false)
    })
    test('should build correct expression object', function () {
      const expr = numberConditions_1.NumberConditions.IsNumber()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsNumber',
        arguments: [],
      })
    })
  })
  describe('IsInteger', function () {
    const evaluate = registry.IsInteger.evaluate
    test('should return true for integers', function () {
      expect(evaluate(0)).toBe(true)
      expect(evaluate(42)).toBe(true)
      expect(evaluate(-5)).toBe(true)
      expect(evaluate(1000000)).toBe(true)
    })
    test('should return false for floats', function () {
      expect(evaluate(3.14)).toBe(false)
      expect(evaluate(0.5)).toBe(false)
      expect(evaluate(-2.7)).toBe(false)
    })
    test('should return false for NaN and Infinity', function () {
      expect(evaluate(NaN)).toBe(false)
      expect(evaluate(Infinity)).toBe(false)
      expect(evaluate(-Infinity)).toBe(false)
    })
    test('should return false for non-numbers', function () {
      expect(evaluate('42')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate(null)).toBe(false)
      expect(evaluate(undefined)).toBe(false)
    })
    test('should build correct expression object', function () {
      const expr = numberConditions_1.NumberConditions.IsInteger()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsInteger',
        arguments: [],
      })
    })
  })
  describe('GreaterThan', function () {
    const evaluate = registry.GreaterThan.evaluate
    test('should return true when value is greater than threshold', function () {
      expect(evaluate(10, 5)).toBe(true)
      expect(evaluate(0, -1)).toBe(true)
      expect(evaluate(1.5, 1.4)).toBe(true)
    })
    test('should return false when value is equal to threshold', function () {
      expect(evaluate(5, 5)).toBe(false)
      expect(evaluate(0, 0)).toBe(false)
    })
    test('should return false when value is less than threshold', function () {
      expect(evaluate(3, 5)).toBe(false)
      expect(evaluate(-1, 0)).toBe(false)
    })
    test('should throw error when value is not a number', function () {
      expect(function () {
        return evaluate('10', 5)
      }).toThrow('Condition.Number.GreaterThan expects a number but received string')
      expect(function () {
        return evaluate(null, 5)
      }).toThrow('Condition.Number.GreaterThan expects a number but received object')
      expect(function () {
        return evaluate(undefined, 5)
      }).toThrow('Condition.Number.GreaterThan expects a number but received undefined')
      expect(function () {
        return evaluate(true, 5)
      }).toThrow('Condition.Number.GreaterThan expects a number but received boolean')
      expect(function () {
        return evaluate({}, 5)
      }).toThrow('Condition.Number.GreaterThan expects a number but received object')
      expect(function () {
        return evaluate(NaN, 5)
      }).toThrow('Condition.Number.GreaterThan expects a number but received NaN')
    })
    test('should handle edge cases with Infinity and negative numbers', function () {
      expect(evaluate(Infinity, 1000)).toBe(true)
      expect(evaluate(-Infinity, 0)).toBe(false)
      expect(evaluate(0, -Infinity)).toBe(true)
    })
    test('should build correct expression object', function () {
      const expr = numberConditions_1.NumberConditions.GreaterThan(5)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'GreaterThan',
        arguments: [5],
      })
    })
  })
  describe('GreaterThanOrEqual', function () {
    const evaluate = registry.GreaterThanOrEqual.evaluate
    test('should return true when value is greater than threshold', function () {
      expect(evaluate(10, 5)).toBe(true)
      expect(evaluate(1.6, 1.5)).toBe(true)
    })
    test('should return true when value is equal to threshold', function () {
      expect(evaluate(5, 5)).toBe(true)
      expect(evaluate(0, 0)).toBe(true)
      expect(evaluate(-10, -10)).toBe(true)
    })
    test('should return false when value is less than threshold', function () {
      expect(evaluate(3, 5)).toBe(false)
      expect(evaluate(-1, 0)).toBe(false)
    })
    test('should throw error when value is not a number', function () {
      expect(function () {
        return evaluate('5', 5)
      }).toThrow('Condition.Number.GreaterThanOrEqual expects a number but received string')
      expect(function () {
        return evaluate([], 5)
      }).toThrow('Condition.Number.GreaterThanOrEqual expects a number but received object')
      expect(function () {
        return evaluate(NaN, 5)
      }).toThrow('Condition.Number.GreaterThanOrEqual expects a number but received NaN')
    })
    test('should build correct expression object', function () {
      const expr = numberConditions_1.NumberConditions.GreaterThanOrEqual(10)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'GreaterThanOrEqual',
        arguments: [10],
      })
    })
  })
  describe('LessThan', function () {
    const evaluate = registry.LessThan.evaluate
    test('should return true when value is less than threshold', function () {
      expect(evaluate(3, 5)).toBe(true)
      expect(evaluate(-1, 0)).toBe(true)
      expect(evaluate(1.4, 1.5)).toBe(true)
    })
    test('should return false when value is equal to threshold', function () {
      expect(evaluate(5, 5)).toBe(false)
      expect(evaluate(0, 0)).toBe(false)
    })
    test('should return false when value is greater than threshold', function () {
      expect(evaluate(10, 5)).toBe(false)
      expect(evaluate(0, -1)).toBe(false)
    })
    test('should throw error when value is not a number', function () {
      expect(function () {
        return evaluate('3', 5)
      }).toThrow('Condition.Number.LessThan expects a number but received string')
      expect(function () {
        return evaluate(NaN, 5)
      }).toThrow('Condition.Number.LessThan expects a number but received NaN')
    })
    test('should handle edge cases with Infinity', function () {
      expect(evaluate(-Infinity, 0)).toBe(true)
      expect(evaluate(0, Infinity)).toBe(true)
      expect(evaluate(Infinity, Infinity)).toBe(false)
    })
    test('should build correct expression object', function () {
      const expr = numberConditions_1.NumberConditions.LessThan(7)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'LessThan',
        arguments: [7],
      })
    })
  })
  describe('LessThanOrEqual', function () {
    const evaluate = registry.LessThanOrEqual.evaluate
    test('should return true when value is less than threshold', function () {
      expect(evaluate(3, 5)).toBe(true)
      expect(evaluate(-10, -5)).toBe(true)
    })
    test('should return true when value is equal to threshold', function () {
      expect(evaluate(5, 5)).toBe(true)
      expect(evaluate(0, 0)).toBe(true)
      expect(evaluate(-7, -7)).toBe(true)
    })
    test('should return false when value is greater than threshold', function () {
      expect(evaluate(10, 5)).toBe(false)
      expect(evaluate(0, -1)).toBe(false)
    })
    test('should throw error when value is not a number', function () {
      expect(function () {
        return evaluate(false, 5)
      }).toThrow('Condition.Number.LessThanOrEqual expects a number but received boolean')
      expect(function () {
        return evaluate(NaN, 5)
      }).toThrow('Condition.Number.LessThanOrEqual expects a number but received NaN')
    })
    test('should build correct expression object', function () {
      const expr = numberConditions_1.NumberConditions.LessThanOrEqual(3)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'LessThanOrEqual',
        arguments: [3],
      })
    })
  })
  describe('Between', function () {
    const evaluate = registry.Between.evaluate
    test('should return true when value is between min and max (inclusive)', function () {
      expect(evaluate(5, 1, 10)).toBe(true)
      expect(evaluate(1, 1, 10)).toBe(true)
      expect(evaluate(10, 1, 10)).toBe(true)
      expect(evaluate(0, -5, 5)).toBe(true)
    })
    test('should return false when value is outside the range', function () {
      expect(evaluate(0, 1, 10)).toBe(false)
      expect(evaluate(11, 1, 10)).toBe(false)
      expect(evaluate(-6, -5, 5)).toBe(false)
    })
    test('should handle decimal values', function () {
      expect(evaluate(5.5, 5.0, 6.0)).toBe(true)
      expect(evaluate(5.0, 5.0, 6.0)).toBe(true)
      expect(evaluate(6.0, 5.0, 6.0)).toBe(true)
      expect(evaluate(4.9, 5.0, 6.0)).toBe(false)
      expect(evaluate(6.1, 5.0, 6.0)).toBe(false)
    })
    test('should handle negative ranges', function () {
      expect(evaluate(-5, -10, -1)).toBe(true)
      expect(evaluate(-10, -10, -1)).toBe(true)
      expect(evaluate(-1, -10, -1)).toBe(true)
      expect(evaluate(0, -10, -1)).toBe(false)
    })
    test('should handle single-point range', function () {
      expect(evaluate(5, 5, 5)).toBe(true)
      expect(evaluate(4, 5, 5)).toBe(false)
      expect(evaluate(6, 5, 5)).toBe(false)
    })
    test('should throw error when value is not a number', function () {
      expect(function () {
        return evaluate('5', 1, 10)
      }).toThrow('Condition.Number.Between expects a number but received string')
      expect(function () {
        return evaluate(null, 1, 10)
      }).toThrow('Condition.Number.Between expects a number but received object')
      expect(function () {
        return evaluate(undefined, 1, 10)
      }).toThrow('Condition.Number.Between expects a number but received undefined')
      expect(function () {
        return evaluate(NaN, 1, 10)
      }).toThrow('Condition.Number.Between expects a number but received NaN')
    })
    test('should handle inverted ranges (max < min)', function () {
      expect(evaluate(5, 10, 1)).toBe(false)
      expect(evaluate(5, 10, 5)).toBe(false)
    })
    test('should build correct expression object', function () {
      const expr = numberConditions_1.NumberConditions.Between(1, 10)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'Between',
        arguments: [1, 10],
      })
    })
  })
})
