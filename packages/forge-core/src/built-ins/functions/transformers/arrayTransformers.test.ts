import { ArrayTransformers, arrayTransformersRegistry } from './arrayTransformers'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('Array Transformers', () => {
  const harness = new FunctionRegistryTestHarness(arrayTransformersRegistry)

  describe('Length', () => {
    it('should return length of array', () => {
      const result = harness.evaluate(ArrayTransformers.Length()).withInput([1, 2, 3, 4])
      expect(result).toBe(4)
    })

    it('should return 0 for empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Length()).withInput([])
      expect(result).toBe(0)
    })

    it('should handle arrays with mixed types', () => {
      const result = harness.evaluate(ArrayTransformers.Length()).withInput([1, 'hello', true, null])
      expect(result).toBe(4)
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Length()).withInput('hello')).toThrow(
        'Array.Length: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      const expr = ArrayTransformers.Length()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'Array.Length',
        arguments: [],
      })
    })
  })

  describe('First', () => {
    it('should return first element of array', () => {
      const result = harness.evaluate(ArrayTransformers.First()).withInput([1, 2, 3])
      expect(result).toBe(1)
    })

    it('should return undefined for empty array', () => {
      const result = harness.evaluate(ArrayTransformers.First()).withInput([])
      expect(result).toBeUndefined()
    })

    it('should handle single element array', () => {
      const result = harness.evaluate(ArrayTransformers.First()).withInput(['hello'])
      expect(result).toBe('hello')
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.First()).withInput('hello')).toThrow(
        'Array.First: value failed schema validation',
      )
    })
  })

  describe('Last', () => {
    it('should return last element of array', () => {
      const result = harness.evaluate(ArrayTransformers.Last()).withInput([1, 2, 3])
      expect(result).toBe(3)
    })

    it('should return undefined for empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Last()).withInput([])
      expect(result).toBeUndefined()
    })

    it('should handle single element array', () => {
      const result = harness.evaluate(ArrayTransformers.Last()).withInput(['hello'])
      expect(result).toBe('hello')
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Last()).withInput('hello')).toThrow(
        'Array.Last: value failed schema validation',
      )
    })
  })

  describe('Reverse', () => {
    it('should reverse array elements', () => {
      const result = harness.evaluate(ArrayTransformers.Reverse()).withInput([1, 2, 3])
      expect(result).toEqual([3, 2, 1])
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Reverse()).withInput([])
      expect(result).toEqual([])
    })

    it('should not modify original array', () => {
      const original = [1, 2, 3]
      const result = harness.evaluate(ArrayTransformers.Reverse()).withInput(original)
      expect(result).toEqual([3, 2, 1])
      expect(original).toEqual([1, 2, 3])
    })

    it('should handle single element array', () => {
      const result = harness.evaluate(ArrayTransformers.Reverse()).withInput(['hello'])
      expect(result).toEqual(['hello'])
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Reverse()).withInput('hello')).toThrow(
        'Array.Reverse: value failed schema validation',
      )
    })
  })

  describe('Join', () => {
    it('should join array elements with default comma separator', () => {
      const result = harness.evaluate(ArrayTransformers.Join()).withInput([1, 2, 3])
      expect(result).toBe('1,2,3')
    })

    it('should join array elements with custom separator', () => {
      const result = harness.evaluate(ArrayTransformers.Join(', ')).withInput([1, 2, 3])
      expect(result).toBe('1, 2, 3')
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Join()).withInput([])
      expect(result).toBe('')
    })

    it('should handle single element array', () => {
      const result = harness.evaluate(ArrayTransformers.Join()).withInput(['hello'])
      expect(result).toBe('hello')
    })

    it('should handle mixed types', () => {
      const result = harness.evaluate(ArrayTransformers.Join(' | ')).withInput([1, 'hello', true])
      expect(result).toBe('1 | hello | true')
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Join()).withInput('hello')).toThrow(
        'Array.Join: value failed schema validation',
      )
    })
  })

  describe('Slice', () => {
    it('should slice array with start and end indices', () => {
      const result = harness.evaluate(ArrayTransformers.Slice(1, 4)).withInput([1, 2, 3, 4, 5])
      expect(result).toEqual([2, 3, 4])
    })

    it('should slice array with only start index', () => {
      const result = harness.evaluate(ArrayTransformers.Slice(2)).withInput([1, 2, 3, 4, 5])
      expect(result).toEqual([3, 4, 5])
    })

    it('should handle negative indices', () => {
      const result = harness.evaluate(ArrayTransformers.Slice(-2)).withInput([1, 2, 3, 4, 5])
      expect(result).toEqual([4, 5])
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Slice(0, 2)).withInput([])
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Slice(1, 3)).withInput('hello')).toThrow(
        'Array.Slice: value failed schema validation',
      )
    })
  })

  describe('Concat', () => {
    it('should concatenate two arrays', () => {
      const result = harness.evaluate(ArrayTransformers.Concat([3, 4])).withInput([1, 2])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should concatenate multiple arrays', () => {
      const result = harness.evaluate(ArrayTransformers.Concat([2, 3], [4, 5])).withInput([1])
      expect(result).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle empty arrays', () => {
      const result = harness.evaluate(ArrayTransformers.Concat([])).withInput([1, 2])
      expect(result).toEqual([1, 2])
    })

    it('should throw error if any argument is not an array', () => {
      expect(() =>
        harness.evaluate(ArrayTransformers.Concat('hello' as unknown as unknown[])).withInput([1, 2]),
      ).toThrow('Array.Concat: arguments failed schema validation')
    })

    it('should throw error for non-array input', () => {
      expect(() => harness.evaluate(ArrayTransformers.Concat([1, 2])).withInput('hello')).toThrow(
        'Array.Concat: value failed schema validation',
      )
    })
  })

  describe('Unique', () => {
    it('should remove duplicate elements', () => {
      const result = harness.evaluate(ArrayTransformers.Unique()).withInput([1, 2, 2, 3, 1])
      expect(result).toEqual([1, 2, 3])
    })

    it('should handle array with no duplicates', () => {
      const result = harness.evaluate(ArrayTransformers.Unique()).withInput([1, 2, 3])
      expect(result).toEqual([1, 2, 3])
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Unique()).withInput([])
      expect(result).toEqual([])
    })

    it('should handle mixed types', () => {
      const result = harness.evaluate(ArrayTransformers.Unique()).withInput([1, '1', 1, 'hello', 'hello'])
      expect(result).toEqual([1, '1', 'hello'])
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Unique()).withInput('hello')).toThrow(
        'Array.Unique: value failed schema validation',
      )
    })
  })

  describe('Sort', () => {
    it('should sort numeric array', () => {
      const result = harness.evaluate(ArrayTransformers.Sort()).withInput([3, 1, 4, 2])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should sort string array', () => {
      const result = harness.evaluate(ArrayTransformers.Sort()).withInput(['banana', 'apple', 'cherry'])
      expect(result).toEqual(['apple', 'banana', 'cherry'])
    })

    it('should handle mixed types by converting to strings', () => {
      const result = harness.evaluate(ArrayTransformers.Sort()).withInput([3, 'apple', 1, 'banana'])
      expect(result).toEqual([1, 3, 'apple', 'banana'])
    })

    it('should not modify original array', () => {
      const original = [3, 1, 4, 2]
      const result = harness.evaluate(ArrayTransformers.Sort()).withInput(original)
      expect(result).toEqual([1, 2, 3, 4])
      expect(original).toEqual([3, 1, 4, 2])
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Sort()).withInput([])
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Sort()).withInput('hello')).toThrow(
        'Array.Sort: value failed schema validation',
      )
    })
  })

  describe('Filter', () => {
    it('should filter array by value', () => {
      const result = harness.evaluate(ArrayTransformers.Filter(2)).withInput([1, 2, 2, 3])
      expect(result).toEqual([2, 2])
    })

    it('should return empty array when no matches', () => {
      const result = harness.evaluate(ArrayTransformers.Filter(4)).withInput([1, 2, 3])
      expect(result).toEqual([])
    })

    it('should handle string filtering', () => {
      const result = harness.evaluate(ArrayTransformers.Filter('apple')).withInput(['apple', 'banana', 'apple'])
      expect(result).toEqual(['apple', 'apple'])
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Filter(1)).withInput([])
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Filter('e')).withInput('hello')).toThrow(
        'Array.Filter: value failed schema validation',
      )
    })
  })

  describe('Map', () => {
    it('should map object properties', () => {
      const result = harness.evaluate(ArrayTransformers.Map('name')).withInput([{ name: 'John' }, { name: 'Jane' }])
      expect(result).toEqual(['John', 'Jane'])
    })

    it('should map array indices', () => {
      const result = harness.evaluate(ArrayTransformers.Map(0)).withInput([
        [1, 2],
        [3, 4],
      ])
      expect(result).toEqual([1, 3])
    })

    it('should return undefined for missing properties', () => {
      const result = harness.evaluate(ArrayTransformers.Map('name')).withInput([{ name: 'John' }, {}])
      expect(result).toEqual(['John', undefined])
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Map('name')).withInput([])
      expect(result).toEqual([])
    })

    it('should return undefined for non-object/non-array items', () => {
      const result = harness.evaluate(ArrayTransformers.Map('name')).withInput([1, 2, 3])
      expect(result).toEqual([undefined, undefined, undefined])
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Map('name')).withInput('hello')).toThrow(
        'Array.Map: value failed schema validation',
      )
    })
  })

  describe('Flatten', () => {
    it('should flatten nested arrays by one level', () => {
      const result = harness.evaluate(ArrayTransformers.Flatten()).withInput([
        [1, 2],
        [3, 4],
      ])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should handle mixed nested and non-nested elements', () => {
      const result = harness.evaluate(ArrayTransformers.Flatten()).withInput([1, [2, 3], 4])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should only flatten one level', () => {
      const result = harness.evaluate(ArrayTransformers.Flatten()).withInput([[[1, 2]], [3, 4]])
      expect(result).toEqual([[1, 2], 3, 4])
    })

    it('should handle empty array', () => {
      const result = harness.evaluate(ArrayTransformers.Flatten()).withInput([])
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => harness.evaluate(ArrayTransformers.Flatten()).withInput('hello')).toThrow(
        'Array.Flatten: value failed schema validation',
      )
    })
  })
})
