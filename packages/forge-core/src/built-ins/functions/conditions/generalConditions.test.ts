import { GeneralConditions, generalConditionsRegistry } from './generalConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('GeneralConditions', () => {
  const harness = new FunctionRegistryTestHarness(generalConditionsRegistry)

  describe('IsRequired', () => {
    test('should return true if a value is provided', () => {
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('hello')).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('0')).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(1)).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(0)).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(true)).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(false)).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput({})).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(['item'])).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(new Date())).toBe(true)
    })

    test('should return false for null and undefined', () => {
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(null)).toBe(false)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(undefined)).toBe(false)
    })

    test('should return false for empty string', () => {
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('')).toBe(false)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('   ')).toBe(false)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('\t')).toBe(false)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('\n')).toBe(false)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('  \t  \n  ')).toBe(false)
    })

    test('should return false for empty array', () => {
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput([])).toBe(false)
    })

    test('should return true for string with content', () => {
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('a')).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(' a ')).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput('   text   ')).toBe(true)
    })

    test('should return true for array with items', () => {
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput([null])).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput([undefined])).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput([''])).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput([1, 2, 3])).toBe(true)
    })

    test('should handle edge cases', () => {
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(NaN)).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(Infinity)).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(-Infinity)).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(new Map())).toBe(true)
      expect(harness.evaluate(GeneralConditions.IsRequired()).withInput(new Set())).toBe(true)
    })

    test('should build correct expression object', () => {
      const expr = GeneralConditions.IsRequired()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'IsRequired',
        arguments: [],
      })
    })
  })

  describe('Equals', () => {
    test('should return true for identical primitive values', () => {
      expect(harness.evaluate(GeneralConditions.Equals('hello')).withInput('hello')).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(123)).withInput(123)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(true)).withInput(true)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(false)).withInput(false)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(null)).withInput(null)).toBe(true)
      // An undefined input short-circuits the condition to false before the function runs.
      // (`Equals` cannot take `undefined` as its expected argument — `ResolvableValue`
      // excludes it — so the original undefined-vs-undefined pairing is not authorable.)
      expect(harness.evaluate(GeneralConditions.Equals(null)).withInput(undefined)).toBe(false)
    })

    test('should return false for different primitive values', () => {
      expect(harness.evaluate(GeneralConditions.Equals('world')).withInput('hello')).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(456)).withInput(123)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(false)).withInput(true)).toBe(false)
      // `Equals` cannot take `undefined` as its expected argument (`ResolvableValue`
      // excludes it); a null input still differs from a defined expected value.
      expect(harness.evaluate(GeneralConditions.Equals(false)).withInput(null)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(false)).withInput(0)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(false)).withInput('')).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(0)).withInput('0')).toBe(false)
    })

    test('should use strict equality for objects', () => {
      const obj1 = { a: 1 }
      const obj2 = { a: 1 }
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 3]

      expect(harness.evaluate(GeneralConditions.Equals(obj1)).withInput(obj1)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(obj2)).withInput(obj1)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(arr1)).withInput(arr1)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(arr2)).withInput(arr1)).toBe(false)
    })

    test('should handle special number values', () => {
      expect(harness.evaluate(GeneralConditions.Equals(NaN)).withInput(NaN)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(Infinity)).withInput(Infinity)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(-Infinity)).withInput(-Infinity)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(-Infinity)).withInput(Infinity)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(-0)).withInput(0)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(0)).withInput(-0)).toBe(true)
    })

    test('should handle mixed types', () => {
      expect(harness.evaluate(GeneralConditions.Equals(123)).withInput('123')).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(1)).withInput(true)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(0)).withInput(false)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(0)).withInput(null)).toBe(false)
      // An undefined input short-circuits the condition to false before the function runs.
      expect(harness.evaluate(GeneralConditions.Equals(null)).withInput(undefined)).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals(0)).withInput([])).toBe(false)
      expect(harness.evaluate(GeneralConditions.Equals('[object Object]')).withInput({})).toBe(false)
    })

    test('should handle function values', () => {
      const func1 = () => 'test'
      const func2 = () => 'test'

      expect(harness.evaluate(GeneralConditions.Equals(func1)).withInput(func1)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(func2)).withInput(func1)).toBe(false)
    })

    test('should handle date values', () => {
      const date1 = new Date('2023-01-01')
      const date2 = new Date('2023-01-01')

      expect(harness.evaluate(GeneralConditions.Equals(date1)).withInput(date1)).toBe(true)
      expect(harness.evaluate(GeneralConditions.Equals(date2)).withInput(date1)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = GeneralConditions.Equals('expectedValue')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Equals',
        arguments: ['expectedValue'],
      })
    })
  })
})
