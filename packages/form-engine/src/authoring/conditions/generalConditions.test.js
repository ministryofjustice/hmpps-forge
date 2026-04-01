Object.defineProperty(exports, '__esModule', { value: true })
const generalConditions_1 = require('./generalConditions')
const defineFunction_1 = require('../utils/defineFunction')
const enums_1 = require('../types/enums')

describe('GeneralConditions', function () {
  const registry = (0, defineFunction_1.createFunctionsRegistry)(generalConditions_1.GeneralConditionsImplementations)
  describe('IsRequired', function () {
    const evaluate = registry.IsRequired.evaluate
    test('should return true if a value is provided', function () {
      expect(evaluate('hello')).toBe(true)
      expect(evaluate('0')).toBe(true)
      expect(evaluate(1)).toBe(true)
      expect(evaluate(0)).toBe(true)
      expect(evaluate(true)).toBe(true)
      expect(evaluate(false)).toBe(true)
      expect(evaluate({})).toBe(true)
      expect(evaluate(['item'])).toBe(true)
      expect(evaluate(new Date())).toBe(true)
    })
    test('should return false for null and undefined', function () {
      expect(evaluate(null)).toBe(false)
      expect(evaluate(undefined)).toBe(false)
    })
    test('should return false for empty string', function () {
      expect(evaluate('')).toBe(false)
      expect(evaluate('   ')).toBe(false)
      expect(evaluate('\t')).toBe(false)
      expect(evaluate('\n')).toBe(false)
      expect(evaluate('  \t  \n  ')).toBe(false)
    })
    test('should return false for empty array', function () {
      expect(evaluate([])).toBe(false)
    })
    test('should return true for string with content', function () {
      expect(evaluate('a')).toBe(true)
      expect(evaluate(' a ')).toBe(true)
      expect(evaluate('   text   ')).toBe(true)
    })
    test('should return true for array with items', function () {
      expect(evaluate([null])).toBe(true)
      expect(evaluate([undefined])).toBe(true)
      expect(evaluate([''])).toBe(true)
      expect(evaluate([1, 2, 3])).toBe(true)
    })
    test('should handle edge cases', function () {
      expect(evaluate(NaN)).toBe(true)
      expect(evaluate(Infinity)).toBe(true)
      expect(evaluate(-Infinity)).toBe(true)
      expect(evaluate(new Map())).toBe(true)
      expect(evaluate(new Set())).toBe(true)
    })
    test('should build correct expression object', function () {
      const expr = generalConditions_1.GeneralConditions.IsRequired()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsRequired',
        arguments: [],
      })
    })
  })
  describe('Equals', function () {
    const evaluate = registry.Equals.evaluate
    test('should return true for identical primitive values', function () {
      expect(evaluate('hello', 'hello')).toBe(true)
      expect(evaluate(123, 123)).toBe(true)
      expect(evaluate(true, true)).toBe(true)
      expect(evaluate(false, false)).toBe(true)
      expect(evaluate(null, null)).toBe(true)
      expect(evaluate(undefined, undefined)).toBe(true)
    })
    test('should return false for different primitive values', function () {
      expect(evaluate('hello', 'world')).toBe(false)
      expect(evaluate(123, 456)).toBe(false)
      expect(evaluate(true, false)).toBe(false)
      expect(evaluate(null, undefined)).toBe(false)
      expect(evaluate(0, false)).toBe(false)
      expect(evaluate('', false)).toBe(false)
      expect(evaluate('0', 0)).toBe(false)
    })
    test('should use strict equality for objects', function () {
      const obj1 = { a: 1 }
      const obj2 = { a: 1 }
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 3]
      expect(evaluate(obj1, obj1)).toBe(true)
      expect(evaluate(obj1, obj2)).toBe(false)
      expect(evaluate(arr1, arr1)).toBe(true)
      expect(evaluate(arr1, arr2)).toBe(false)
    })
    test('should handle special number values', function () {
      expect(evaluate(NaN, NaN)).toBe(false)
      expect(evaluate(Infinity, Infinity)).toBe(true)
      expect(evaluate(-Infinity, -Infinity)).toBe(true)
      expect(evaluate(Infinity, -Infinity)).toBe(false)
      expect(evaluate(0, -0)).toBe(true)
      expect(evaluate(-0, 0)).toBe(true)
    })
    test('should handle mixed types', function () {
      expect(evaluate('123', 123)).toBe(false)
      expect(evaluate(true, 1)).toBe(false)
      expect(evaluate(false, 0)).toBe(false)
      expect(evaluate(null, 0)).toBe(false)
      expect(evaluate(undefined, null)).toBe(false)
      expect(evaluate([], 0)).toBe(false)
      expect(evaluate({}, '[object Object]')).toBe(false)
    })
    test('should handle function values', function () {
      const func1 = function () {
        return 'test'
      }
      const func2 = function () {
        return 'test'
      }
      expect(evaluate(func1, func1)).toBe(true)
      expect(evaluate(func1, func2)).toBe(false)
    })
    test('should handle date values', function () {
      const date1 = new Date('2023-01-01')
      const date2 = new Date('2023-01-01')
      expect(evaluate(date1, date1)).toBe(true)
      expect(evaluate(date1, date2)).toBe(false)
    })
    test('should build correct expression object', function () {
      const expr = generalConditions_1.GeneralConditions.Equals('expectedValue')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'Equals',
        arguments: ['expectedValue'],
      })
    })
  })
})
