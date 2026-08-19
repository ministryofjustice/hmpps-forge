import { ArrayConditions, arrayConditionsRegistry } from './arrayConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('ArrayConditions', () => {
  const harness = new FunctionRegistryTestHarness(arrayConditionsRegistry)

  describe('IsArray', () => {
    test('should return true when value is an array', () => {
      expect(harness.evaluate(ArrayConditions.IsArray()).withInput([])).toBe(true)
      expect(harness.evaluate(ArrayConditions.IsArray()).withInput(['foo', 'bar', 'baz'])).toBe(true)
    })

    test('should return false when value is not an array', () => {
      expect(harness.evaluate(ArrayConditions.IsArray()).withInput('foo')).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsArray()).withInput(123)).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsArray()).withInput(null)).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsArray()).withInput(undefined)).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsArray()).withInput({})).toBe(false)
    })
  })

  describe('IsIn', () => {
    test('should return true when value is in the expected array', () => {
      expect(harness.evaluate(ArrayConditions.IsIn(['apple', 'banana', 'orange'])).withInput('apple')).toBe(true)
      expect(harness.evaluate(ArrayConditions.IsIn([1, 2, 3])).withInput(1)).toBe(true)
      expect(harness.evaluate(ArrayConditions.IsIn([false, true])).withInput(true)).toBe(true)
    })

    test('should return false when value is not in the expected array', () => {
      expect(harness.evaluate(ArrayConditions.IsIn(['apple', 'banana', 'orange'])).withInput('grape')).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn([1, 2, 3])).withInput(4)).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn([1, 2, 3])).withInput('1')).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn([true])).withInput(false)).toBe(false)
    })

    test('should handle empty array', () => {
      expect(harness.evaluate(ArrayConditions.IsIn([])).withInput('anything')).toBe(false)
    })

    test('should use strict equality', () => {
      expect(harness.evaluate(ArrayConditions.IsIn([1])).withInput('1')).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn(['1'])).withInput(1)).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn([false])).withInput(0)).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn([0])).withInput(false)).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn([undefined])).withInput(null)).toBe(false)
    })

    test('should handle complex values', () => {
      const obj = { a: 1 }
      const arr = [1, 2]
      expect(harness.evaluate(ArrayConditions.IsIn([obj, { b: 2 }])).withInput(obj)).toBe(true)
      expect(harness.evaluate(ArrayConditions.IsIn([arr, [3, 4]])).withInput(arr)).toBe(true)
      expect(harness.evaluate(ArrayConditions.IsIn([{ a: 1 }])).withInput({ a: 1 })).toBe(false)
      expect(harness.evaluate(ArrayConditions.IsIn([[1, 2]])).withInput([1, 2])).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.IsIn(['option1', 'option2'])
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Array.IsIn',
        arguments: [['option1', 'option2']],
      })
    })
  })

  describe('Contains', () => {
    test('should return true when value array contains the expected value', () => {
      expect(harness.evaluate(ArrayConditions.Contains('apple')).withInput(['apple', 'banana'])).toBe(true)
      expect(harness.evaluate(ArrayConditions.Contains(2)).withInput([1, 2, 3])).toBe(true)
      expect(harness.evaluate(ArrayConditions.Contains(false)).withInput([true, false])).toBe(true)
    })

    test('should return false when value array does not contain the expected value', () => {
      expect(harness.evaluate(ArrayConditions.Contains('orange')).withInput(['apple', 'banana'])).toBe(false)
      expect(harness.evaluate(ArrayConditions.Contains(4)).withInput([1, 2, 3])).toBe(false)
      expect(harness.evaluate(ArrayConditions.Contains(false)).withInput([true])).toBe(false)
    })

    test('should handle empty array', () => {
      expect(harness.evaluate(ArrayConditions.Contains('anything')).withInput([])).toBe(false)
    })

    test('should use strict equality', () => {
      expect(harness.evaluate(ArrayConditions.Contains('2')).withInput([1, 2, 3])).toBe(false)
      expect(harness.evaluate(ArrayConditions.Contains(2)).withInput(['1', '2', '3'])).toBe(false)
      expect(harness.evaluate(ArrayConditions.Contains(false)).withInput([0])).toBe(false)
      expect(harness.evaluate(ArrayConditions.Contains(0)).withInput([false])).toBe(false)
    })

    test('should handle complex values', () => {
      const obj = { a: 1 }
      const arr = [1, 2]
      expect(harness.evaluate(ArrayConditions.Contains(obj)).withInput([obj, { b: 2 }])).toBe(true)
      expect(harness.evaluate(ArrayConditions.Contains(arr)).withInput([arr, [3, 4]])).toBe(true)
      expect(harness.evaluate(ArrayConditions.Contains({ a: 1 })).withInput([{ a: 1 }])).toBe(false)
      expect(harness.evaluate(ArrayConditions.Contains([1, 2])).withInput([[1, 2]])).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.Contains('searchValue')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Array.Contains',
        arguments: ['searchValue'],
      })
    })
  })

  describe('ContainsAny', () => {
    test('should return true when value array contains any of the items from expected array', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAny(['orange', 'apple'])).withInput(['apple', 'banana'])).toBe(
        true,
      )
      expect(harness.evaluate(ArrayConditions.ContainsAny([3, 4, 5])).withInput([1, 2, 3])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAny(['x', 'y', 'z', 'a'])).withInput(['a', 'b', 'c'])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAny([false])).withInput([true, false])).toBe(true)
    })

    test('should return false when value array contains none of the items from expected array', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAny(['orange', 'grape'])).withInput(['apple', 'banana'])).toBe(
        false,
      )
      expect(harness.evaluate(ArrayConditions.ContainsAny([4, 5, 6])).withInput([1, 2, 3])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAny(['x', 'y', 'z'])).withInput(['a', 'b'])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAny([false])).withInput([true])).toBe(false)
    })

    test('should handle empty arrays', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAny(['anything'])).withInput([])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAny([])).withInput([])).toBe(true)
    })

    test('should use strict equality', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAny(['1', '2'])).withInput([1, 2])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAny([1, 2])).withInput(['1', '2'])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAny([false])).withInput([0])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAny([0])).withInput([false])).toBe(false)
    })

    test('should handle complex values with reference equality', () => {
      const obj1 = { a: 1 }
      const obj2 = { a: 1 }
      const arr1 = [1, 2]
      const arr2 = [1, 2]

      expect(harness.evaluate(ArrayConditions.ContainsAny([obj1, obj2])).withInput([obj1, 'test'])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAny([obj2])).withInput([obj1, 'test'])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAny([arr1, arr2])).withInput([arr1, 'test'])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAny([arr2])).withInput([arr1, 'test'])).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.ContainsAny(['value1', 'value2'])
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Array.ContainsAny',
        arguments: [['value1', 'value2']],
      })
    })
  })

  describe('ContainsAll', () => {
    test('should return true when all items in value array are in expected array', () => {
      expect(
        harness.evaluate(ArrayConditions.ContainsAll(['apple', 'banana', 'orange'])).withInput(['apple', 'banana']),
      ).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll([1, 2, 3, 4])).withInput([1, 2])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll(['a', 'b', 'c'])).withInput(['a'])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll([true, false])).withInput([true])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll(['anything'])).withInput([])).toBe(true)
    })

    test('should return true for identical arrays regardless of order', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAll(['banana', 'apple'])).withInput(['apple', 'banana'])).toBe(
        true,
      )
      expect(harness.evaluate(ArrayConditions.ContainsAll([3, 1, 2])).withInput([1, 2, 3])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll(['c', 'a', 'b'])).withInput(['a', 'b', 'c'])).toBe(true)
    })

    test('should return false when value array has items not in expected array', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAll(['apple', 'banana'])).withInput(['apple', 'grape'])).toBe(
        false,
      )
      expect(harness.evaluate(ArrayConditions.ContainsAll([1, 2, 3, 4])).withInput([1, 2, 5])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAll(['a', 'b', 'c'])).withInput(['a', 'x'])).toBe(false)
    })

    test('should handle empty arrays', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAll([])).withInput([])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll(['anything'])).withInput([])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll([])).withInput(['anything'])).toBe(false)
    })

    test('should handle duplicate values correctly', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAll(['apple', 'banana'])).withInput(['apple', 'apple'])).toBe(
        true,
      )
      expect(harness.evaluate(ArrayConditions.ContainsAll([1, 2, 3])).withInput([1, 1, 2])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll(['a', 'b'])).withInput(['a', 'a', 'b'])).toBe(true)
    })

    test('should use strict equality', () => {
      expect(harness.evaluate(ArrayConditions.ContainsAll(['1', '2', 3])).withInput([1, 2])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAll([1, 2, 3])).withInput(['1', '2'])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAll([false, 1])).withInput([0])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAll([0, 1])).withInput([false])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAll([undefined, 'test'])).withInput([null])).toBe(false)
    })

    test('should handle complex values with reference equality', () => {
      const obj1 = { a: 1 }
      const obj2 = { a: 1 }
      const arr1 = [1, 2]
      const arr2 = [1, 2]

      expect(harness.evaluate(ArrayConditions.ContainsAll([obj1, obj2])).withInput([obj1])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll([obj2])).withInput([obj1])).toBe(false)
      expect(harness.evaluate(ArrayConditions.ContainsAll([arr1, arr2])).withInput([arr1])).toBe(true)
      expect(harness.evaluate(ArrayConditions.ContainsAll([arr2])).withInput([arr1])).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.ContainsAll([1, 2, 3])
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Array.ContainsAll',
        arguments: [[1, 2, 3]],
      })
    })
  })
})
