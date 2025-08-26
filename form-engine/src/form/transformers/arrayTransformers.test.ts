import ArrayTransformers from './arrayTransformers'
import { FunctionType } from '../types/enums'

describe('Array Transformers', () => {
  describe('Length', () => {
    const { evaluate } = ArrayTransformers.Length.spec

    it('should return length of array', () => {
      const result = evaluate([1, 2, 3, 4])
      expect(result).toBe(4)
    })

    it('should return 0 for empty array', () => {
      const result = evaluate([])
      expect(result).toBe(0)
    })

    it('should handle arrays with mixed types', () => {
      const result = evaluate([1, 'hello', true, null])
      expect(result).toBe(4)
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.Length expects an array but received string.')
    })

    it('should return a function expression when called', () => {
      const expr = ArrayTransformers.Length()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'length',
        arguments: [],
      })
    })
  })

  describe('First', () => {
    const { evaluate } = ArrayTransformers.First.spec

    it('should return first element of array', () => {
      const result = evaluate([1, 2, 3])
      expect(result).toBe(1)
    })

    it('should return undefined for empty array', () => {
      const result = evaluate([])
      expect(result).toBeUndefined()
    })

    it('should handle single element array', () => {
      const result = evaluate(['hello'])
      expect(result).toBe('hello')
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.First expects an array but received string.')
    })
  })

  describe('Last', () => {
    const { evaluate } = ArrayTransformers.Last.spec

    it('should return last element of array', () => {
      const result = evaluate([1, 2, 3])
      expect(result).toBe(3)
    })

    it('should return undefined for empty array', () => {
      const result = evaluate([])
      expect(result).toBeUndefined()
    })

    it('should handle single element array', () => {
      const result = evaluate(['hello'])
      expect(result).toBe('hello')
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.Last expects an array but received string.')
    })
  })

  describe('Reverse', () => {
    const { evaluate } = ArrayTransformers.Reverse.spec

    it('should reverse array elements', () => {
      const result = evaluate([1, 2, 3])
      expect(result).toEqual([3, 2, 1])
    })

    it('should handle empty array', () => {
      const result = evaluate([])
      expect(result).toEqual([])
    })

    it('should not modify original array', () => {
      const original = [1, 2, 3]
      const result = evaluate(original)
      expect(result).toEqual([3, 2, 1])
      expect(original).toEqual([1, 2, 3])
    })

    it('should handle single element array', () => {
      const result = evaluate(['hello'])
      expect(result).toEqual(['hello'])
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.Reverse expects an array but received string.')
    })
  })

  describe('Join', () => {
    const { evaluate } = ArrayTransformers.Join.spec

    it('should join array elements with default comma separator', () => {
      const result = evaluate([1, 2, 3])
      expect(result).toBe('1,2,3')
    })

    it('should join array elements with custom separator', () => {
      const result = evaluate([1, 2, 3], ', ')
      expect(result).toBe('1, 2, 3')
    })

    it('should handle empty array', () => {
      const result = evaluate([])
      expect(result).toBe('')
    })

    it('should handle single element array', () => {
      const result = evaluate(['hello'])
      expect(result).toBe('hello')
    })

    it('should handle mixed types', () => {
      const result = evaluate([1, 'hello', true], ' | ')
      expect(result).toBe('1 | hello | true')
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.Join expects an array but received string.')
    })
  })

  describe('Slice', () => {
    const { evaluate } = ArrayTransformers.Slice.spec

    it('should slice array with start and end indices', () => {
      const result = evaluate([1, 2, 3, 4, 5], 1, 4)
      expect(result).toEqual([2, 3, 4])
    })

    it('should slice array with only start index', () => {
      const result = evaluate([1, 2, 3, 4, 5], 2)
      expect(result).toEqual([3, 4, 5])
    })

    it('should handle negative indices', () => {
      const result = evaluate([1, 2, 3, 4, 5], -2)
      expect(result).toEqual([4, 5])
    })

    it('should handle empty array', () => {
      const result = evaluate([], 0, 2)
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello', 1, 3)).toThrow('Transformer.Array.Slice expects an array but received string.')
    })
  })

  describe('Concat', () => {
    const { evaluate } = ArrayTransformers.Concat.spec

    it('should concatenate two arrays', () => {
      const result = evaluate([1, 2], [3, 4])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should concatenate multiple arrays', () => {
      const result = evaluate([1], [2, 3], [4, 5])
      expect(result).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle empty arrays', () => {
      const result = evaluate([1, 2], [])
      expect(result).toEqual([1, 2])
    })

    it('should throw error if any argument is not an array', () => {
      // @ts-expect-error - Needs to be incorrect type for test
      expect(() => evaluate([1, 2], 'hello')).toThrow('Expected array at position 1 for Transformer.Array.Concat')
    })

    it('should throw error for non-array input', () => {
      expect(() => evaluate('hello', [1, 2])).toThrow('Transformer.Array.Concat expects an array but received string.')
    })
  })

  describe('Unique', () => {
    const { evaluate } = ArrayTransformers.Unique.spec

    it('should remove duplicate elements', () => {
      const result = evaluate([1, 2, 2, 3, 1])
      expect(result).toEqual([1, 2, 3])
    })

    it('should handle array with no duplicates', () => {
      const result = evaluate([1, 2, 3])
      expect(result).toEqual([1, 2, 3])
    })

    it('should handle empty array', () => {
      const result = evaluate([])
      expect(result).toEqual([])
    })

    it('should handle mixed types', () => {
      const result = evaluate([1, '1', 1, 'hello', 'hello'])
      expect(result).toEqual([1, '1', 'hello'])
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.Unique expects an array but received string.')
    })
  })

  describe('Sort', () => {
    const { evaluate } = ArrayTransformers.Sort.spec

    it('should sort numeric array', () => {
      const result = evaluate([3, 1, 4, 2])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should sort string array', () => {
      const result = evaluate(['banana', 'apple', 'cherry'])
      expect(result).toEqual(['apple', 'banana', 'cherry'])
    })

    it('should handle mixed types by converting to strings', () => {
      const result = evaluate([3, 'apple', 1, 'banana'])
      expect(result).toEqual([1, 3, 'apple', 'banana'])
    })

    it('should not modify original array', () => {
      const original = [3, 1, 4, 2]
      const result = evaluate(original)
      expect(result).toEqual([1, 2, 3, 4])
      expect(original).toEqual([3, 1, 4, 2])
    })

    it('should handle empty array', () => {
      const result = evaluate([])
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.Sort expects an array but received string.')
    })
  })

  describe('Filter', () => {
    const { evaluate } = ArrayTransformers.Filter.spec

    it('should filter array by value', () => {
      const result = evaluate([1, 2, 2, 3], 2)
      expect(result).toEqual([2, 2])
    })

    it('should return empty array when no matches', () => {
      const result = evaluate([1, 2, 3], 4)
      expect(result).toEqual([])
    })

    it('should handle string filtering', () => {
      const result = evaluate(['apple', 'banana', 'apple'], 'apple')
      expect(result).toEqual(['apple', 'apple'])
    })

    it('should handle empty array', () => {
      const result = evaluate([], 1)
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello', 'e')).toThrow('Transformer.Array.Filter expects an array but received string.')
    })
  })

  describe('Map', () => {
    const { evaluate } = ArrayTransformers.Map.spec

    it('should map object properties', () => {
      const result = evaluate([{ name: 'John' }, { name: 'Jane' }], 'name')
      expect(result).toEqual(['John', 'Jane'])
    })

    it('should map array indices', () => {
      const result = evaluate(
        [
          [1, 2],
          [3, 4],
        ],
        0,
      )
      expect(result).toEqual([1, 3])
    })

    it('should return undefined for missing properties', () => {
      const result = evaluate([{ name: 'John' }, {}], 'name')
      expect(result).toEqual(['John', undefined])
    })

    it('should handle empty array', () => {
      const result = evaluate([], 'name')
      expect(result).toEqual([])
    })

    it('should return undefined for non-object/non-array items', () => {
      const result = evaluate([1, 2, 3], 'name')
      expect(result).toEqual([undefined, undefined, undefined])
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello', 'name')).toThrow('Transformer.Array.Map expects an array but received string.')
    })
  })

  describe('Flatten', () => {
    const { evaluate } = ArrayTransformers.Flatten.spec

    it('should flatten nested arrays by one level', () => {
      const result = evaluate([
        [1, 2],
        [3, 4],
      ])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should handle mixed nested and non-nested elements', () => {
      const result = evaluate([1, [2, 3], 4])
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should only flatten one level', () => {
      const result = evaluate([[[1, 2]], [3, 4]])
      expect(result).toEqual([[1, 2], 3, 4])
    })

    it('should handle empty array', () => {
      const result = evaluate([])
      expect(result).toEqual([])
    })

    it('should throw error for non-array values', () => {
      expect(() => evaluate('hello')).toThrow('Transformer.Array.Flatten expects an array but received string.')
    })
  })
})
