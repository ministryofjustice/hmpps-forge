import ArrayConditions from './arrayConditions'

describe('ArrayConditions', () => {
  describe('IsIn', () => {
    const { evaluate } = ArrayConditions.IsIn.spec

    test('should return true when value is in the expected array', () => {
      expect(evaluate('apple', ['apple', 'banana', 'orange'])).toBe(true)
      expect(evaluate(1, [1, 2, 3])).toBe(true)
      expect(evaluate(true, [false, true])).toBe(true)
    })

    test('should return false when value is not in the expected array', () => {
      expect(evaluate('grape', ['apple', 'banana', 'orange'])).toBe(false)
      expect(evaluate(4, [1, 2, 3])).toBe(false)
      expect(evaluate('1', [1, 2, 3])).toBe(false)
      expect(evaluate(false, [true])).toBe(false)
    })

    test('should handle empty array', () => {
      expect(evaluate('anything', [])).toBe(false)
    })

    test('should use strict equality', () => {
      expect(evaluate('1', [1])).toBe(false)
      expect(evaluate(1, ['1'])).toBe(false)
      expect(evaluate(0, [false])).toBe(false)
      expect(evaluate(false, [0])).toBe(false)
      expect(evaluate(null, [undefined])).toBe(false)
    })

    test('should handle complex values', () => {
      const obj = { a: 1 }
      const arr = [1, 2]
      expect(evaluate(obj, [obj, { b: 2 }])).toBe(true)
      expect(evaluate(arr, [arr, [3, 4]])).toBe(true)
      expect(evaluate({ a: 1 }, [{ a: 1 }])).toBe(false)
      expect(evaluate([1, 2], [[1, 2]])).toBe(false)
    })

    test('should throw error when expected is not an array', () => {
      expect(() => evaluate('test', 'not-an-array' as any)).toThrow(
        'Condition.Array.IsIn expects an array but received string',
      )
      expect(() => evaluate('test', null as any)).toThrow('Condition.Array.IsIn expects an array but received object')
      expect(() => evaluate('test', undefined as any)).toThrow(
        'Condition.Array.IsIn expects an array but received undefined',
      )
      expect(() => evaluate('test', 123 as any)).toThrow('Condition.Array.IsIn expects an array but received number')
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.IsIn(['option1', 'option2'])
      expect(expr).toEqual({
        type: 'function',
        name: 'arrayIsIn',
        arguments: [['option1', 'option2']],
      })
    })
  })

  describe('Contains', () => {
    const { evaluate } = ArrayConditions.Contains.spec

    test('should return true when value array contains the expected value', () => {
      expect(evaluate(['apple', 'banana'], 'apple')).toBe(true)
      expect(evaluate([1, 2, 3], 2)).toBe(true)
      expect(evaluate([true, false], false)).toBe(true)
    })

    test('should return false when value array does not contain the expected value', () => {
      expect(evaluate(['apple', 'banana'], 'orange')).toBe(false)
      expect(evaluate([1, 2, 3], 4)).toBe(false)
      expect(evaluate([true], false)).toBe(false)
    })

    test('should handle empty array', () => {
      expect(evaluate([], 'anything')).toBe(false)
    })

    test('should use strict equality', () => {
      expect(evaluate([1, 2, 3], '2')).toBe(false)
      expect(evaluate(['1', '2', '3'], 2)).toBe(false)
      expect(evaluate([0], false)).toBe(false)
      expect(evaluate([false], 0)).toBe(false)
    })

    test('should handle complex values', () => {
      const obj = { a: 1 }
      const arr = [1, 2]
      expect(evaluate([obj, { b: 2 }], obj)).toBe(true)
      expect(evaluate([arr, [3, 4]], arr)).toBe(true)
      expect(evaluate([{ a: 1 }], { a: 1 })).toBe(false)
      expect(evaluate([[1, 2]], [1, 2])).toBe(false)
    })

    test('should throw error when value is not an array', () => {
      expect(() => evaluate('not-an-array' as any, 'test')).toThrow(
        'Condition.Array.Contains expects an array but received string',
      )
      expect(() => evaluate(null as any, 'test')).toThrow(
        'Condition.Array.Contains expects an array but received object',
      )
      expect(() => evaluate(undefined as any, 'test')).toThrow(
        'Condition.Array.Contains expects an array but received undefined',
      )
      expect(() => evaluate(123 as any, 'test')).toThrow(
        'Condition.Array.Contains expects an array but received number',
      )
      expect(() => evaluate({} as any, 'test')).toThrow('Condition.Array.Contains expects an array but received object')
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.Contains('searchValue')
      expect(expr).toEqual({
        type: 'function',
        name: 'arrayContains',
        arguments: ['searchValue'],
      })
    })
  })

  describe('ContainsAny', () => {
    const { evaluate } = ArrayConditions.ContainsAny.spec

    test('should return true when value array contains any of the items from expected array', () => {
      expect(evaluate(['apple', 'banana'], ['orange', 'apple'])).toBe(true)
      expect(evaluate([1, 2, 3], [3, 4, 5])).toBe(true)
      expect(evaluate(['a', 'b', 'c'], ['x', 'y', 'z', 'a'])).toBe(true)
      expect(evaluate([true, false], [false])).toBe(true)
    })

    test('should return false when value array contains none of the items from expected array', () => {
      expect(evaluate(['apple', 'banana'], ['orange', 'grape'])).toBe(false)
      expect(evaluate([1, 2, 3], [4, 5, 6])).toBe(false)
      expect(evaluate(['a', 'b'], ['x', 'y', 'z'])).toBe(false)
      expect(evaluate([true], [false])).toBe(false)
    })

    test('should handle empty arrays', () => {
      expect(evaluate([], ['anything'])).toBe(false)
      expect(evaluate([], [])).toBe(true)
    })

    test('should use strict equality', () => {
      expect(evaluate([1, 2], ['1', '2'])).toBe(false)
      expect(evaluate(['1', '2'], [1, 2])).toBe(false)
      expect(evaluate([0], [false])).toBe(false)
      expect(evaluate([false], [0])).toBe(false)
    })

    test('should handle complex values with reference equality', () => {
      const obj1 = { a: 1 }
      const obj2 = { a: 1 }
      const arr1 = [1, 2]
      const arr2 = [1, 2]

      expect(evaluate([obj1, 'test'], [obj1, obj2])).toBe(true)
      expect(evaluate([obj1, 'test'], [obj2])).toBe(false)
      expect(evaluate([arr1, 'test'], [arr1, arr2])).toBe(true)
      expect(evaluate([arr1, 'test'], [arr2])).toBe(false)
    })

    test('should throw error when value is not an array', () => {
      expect(() => evaluate('not-an-array' as any, ['test'])).toThrow(
        'Condition.Array.ContainsAny expects an array but received string',
      )
      expect(() => evaluate(null as any, ['test'])).toThrow(
        'Condition.Array.ContainsAny expects an array but received object',
      )
      expect(() => evaluate(undefined as any, ['test'])).toThrow(
        'Condition.Array.ContainsAny expects an array but received undefined',
      )
      expect(() => evaluate(123 as any, ['test'])).toThrow(
        'Condition.Array.ContainsAny expects an array but received number',
      )
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.ContainsAny(['value1', 'value2'])
      expect(expr).toEqual({
        type: 'function',
        name: 'arrayContainsAny',
        arguments: [['value1', 'value2']],
      })
    })
  })

  describe('ContainsAll', () => {
    const { evaluate } = ArrayConditions.ContainsAll.spec

    test('should return true when all items in value array are in expected array', () => {
      expect(evaluate(['apple', 'banana'], ['apple', 'banana', 'orange'])).toBe(true)
      expect(evaluate([1, 2], [1, 2, 3, 4])).toBe(true)
      expect(evaluate(['a'], ['a', 'b', 'c'])).toBe(true)
      expect(evaluate([true], [true, false])).toBe(true)
      expect(evaluate([], ['anything'])).toBe(true)
    })

    test('should return true for identical arrays regardless of order', () => {
      expect(evaluate(['apple', 'banana'], ['banana', 'apple'])).toBe(true)
      expect(evaluate([1, 2, 3], [3, 1, 2])).toBe(true)
      expect(evaluate(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true)
    })

    test('should return false when value array has items not in expected array', () => {
      expect(evaluate(['apple', 'grape'], ['apple', 'banana'])).toBe(false)
      expect(evaluate([1, 2, 5], [1, 2, 3, 4])).toBe(false)
      expect(evaluate(['a', 'x'], ['a', 'b', 'c'])).toBe(false)
    })

    test('should handle empty arrays', () => {
      expect(evaluate([], [])).toBe(true)
      expect(evaluate([], ['anything'])).toBe(true)
      expect(evaluate(['anything'], [])).toBe(false)
    })

    test('should handle duplicate values correctly', () => {
      expect(evaluate(['apple', 'apple'], ['apple', 'banana'])).toBe(true)
      expect(evaluate([1, 1, 2], [1, 2, 3])).toBe(true)
      expect(evaluate(['a', 'a', 'b'], ['a', 'b'])).toBe(true)
    })

    test('should use strict equality', () => {
      expect(evaluate([1, 2], ['1', '2', 3])).toBe(false)
      expect(evaluate(['1', '2'], [1, 2, 3])).toBe(false)
      expect(evaluate([0], [false, 1])).toBe(false)
      expect(evaluate([false], [0, 1])).toBe(false)
      expect(evaluate([null], [undefined, 'test'])).toBe(false)
    })

    test('should handle complex values with reference equality', () => {
      const obj1 = { a: 1 }
      const obj2 = { a: 1 }
      const arr1 = [1, 2]
      const arr2 = [1, 2]

      expect(evaluate([obj1], [obj1, obj2])).toBe(true)
      expect(evaluate([obj1], [obj2])).toBe(false)
      expect(evaluate([arr1], [arr1, arr2])).toBe(true)
      expect(evaluate([arr1], [arr2])).toBe(false)
    })

    test('should throw error when value is not an array', () => {
      expect(() => evaluate('not-an-array' as any, [1, 2])).toThrow(
        'Condition.Array.ContainsAll expects an array but received string',
      )
      expect(() => evaluate(null as any, [1, 2])).toThrow(
        'Condition.Array.ContainsAll expects an array but received object',
      )
      expect(() => evaluate(undefined as any, [1, 2])).toThrow(
        'Condition.Array.ContainsAll expects an array but received undefined',
      )
      expect(() => evaluate(123 as any, [1, 2])).toThrow(
        'Condition.Array.ContainsAll expects an array but received number',
      )
    })

    test('should build correct expression object', () => {
      const expr = ArrayConditions.ContainsAll([1, 2, 3])
      expect(expr).toEqual({
        type: 'function',
        name: 'arrayContainsAll',
        arguments: [[1, 2, 3]],
      })
    })
  })
})
