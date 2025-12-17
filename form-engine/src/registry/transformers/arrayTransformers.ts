import { assertArray, assertNumber, assertString } from '@form-engine/registry/utils/asserts'
import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'
import { ValueExpr } from '@form-engine/form/types/expressions.type'

/**
 * Array transformation functions for manipulating collections of data
 *
 * All config arguments accept both static values and expressions:
 * - Static: Transformer.Array.Slice(0, 5)
 * - Dynamic: Transformer.Array.Slice(0, Answer('limit'))
 */
export const { transformers: ArrayTransformers, registry: ArrayTransformersRegistry } = defineTransformers({
  /**
   * Returns the length of the array
   * @example
   * // Length([1, 2, 3, 4]) returns 4
   */
  Length: (value: any) => {
    assertArray(value, 'Transformer.Array.Length')
    return value.length
  },

  /**
   * Returns the first element of the array
   * @example
   * // First([1, 2, 3]) returns 1
   */
  First: (value: any) => {
    assertArray(value, 'Transformer.Array.First')
    return value.length > 0 ? value[0] : undefined
  },

  /**
   * Returns the last element of the array
   * @example
   * // Last([1, 2, 3]) returns 3
   */
  Last: (value: any) => {
    assertArray(value, 'Transformer.Array.Last')
    return value.length > 0 ? value[value.length - 1] : undefined
  },

  /**
   * Reverses the array (returns a new array)
   * @example
   * // Reverse([1, 2, 3]) returns [3, 2, 1]
   */
  Reverse: (value: any) => {
    assertArray(value, 'Transformer.Array.Reverse')
    return [...value].reverse()
  },

  /**
   * Joins array elements into a string with specified separator
   * @example
   * // Join([1, 2, 3], ", ") returns "1, 2, 3"
   */
  Join: (value: any, separator: string | ValueExpr = ',') => {
    assertArray(value, 'Transformer.Array.Join')
    assertString(separator, 'Transformer.Array.Join (separator)')
    return value.join(separator)
  },

  /**
   * Returns a slice of the array from start to end index
   * @example
   * // Slice([1, 2, 3, 4, 5], 1, 4) returns [2, 3, 4]
   */
  Slice: (value: any, start: number | ValueExpr, end?: number | ValueExpr) => {
    assertArray(value, 'Transformer.Array.Slice')
    assertNumber(start, 'Transformer.Array.Slice (start)')
    if (end !== undefined) {
      assertNumber(end, 'Transformer.Array.Slice (end)')
      return value.slice(start, end)
    }
    return value.slice(start)
  },

  /**
   * Concatenates arrays together
   * @example
   * // Concat([1, 2], [3, 4]) returns [1, 2, 3, 4]
   */
  Concat: (value: any, ...arrays: (any[] | ValueExpr)[]) => {
    assertArray(value, 'Transformer.Array.Concat')
    arrays.forEach((arr, index) => {
      assertArray(arr, `Transformer.Array.Concat (array at position ${index + 1})`)
    })
    return value.concat(...(arrays as any[][]))
  },

  /**
   * Returns unique elements from the array (removes duplicates)
   * @example
   * // Unique([1, 2, 2, 3, 1]) returns [1, 2, 3]
   */
  Unique: (value: any) => {
    assertArray(value, 'Transformer.Array.Unique')
    return [...new Set(value)]
  },

  /**
   * Sorts the array in ascending order (returns a new array)
   * @example
   * // Sort([3, 1, 4, 2]) returns [1, 2, 3, 4]
   */
  Sort: (value: any) => {
    assertArray(value, 'Transformer.Array.Sort')
    return [...value].sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b
      }
      return String(a).localeCompare(String(b))
    })
  },

  /**
   * Filters the array to only include elements that match the specified value
   * @example
   * // Filter([1, 2, 2, 3], 2) returns [2, 2]
   */
  Filter: (value: any, filterValue: any | ValueExpr) => {
    assertArray(value, 'Transformer.Array.Filter')
    return value.filter((item: any) => item === filterValue)
  },

  /**
   * Maps each array element by extracting a property (for objects) or applying an index (for arrays)
   * @example
   * // Map([{name: 'John'}, {name: 'Jane'}], 'name') returns ['John', 'Jane']
   * // Map([[1, 2], [3, 4]], 0) returns [1, 3]
   */
  Map: (value: any, property: string | number | ValueExpr) => {
    assertArray(value, 'Transformer.Array.Map')
    if (typeof property !== 'string' && typeof property !== 'number') {
      throw new Error(`Transformer.Array.Map (property) expects a string or number but received ${typeof property}.`)
    }
    return value.map((item: any) => {
      if (typeof property === 'number' && Array.isArray(item)) {
        return item[property]
      }
      if (typeof property === 'string' && typeof item === 'object' && item !== null) {
        return item[property]
      }
      return undefined
    })
  },

  /**
   * Flattens a nested array by one level
   * @example
   * // Flatten([[1, 2], [3, 4]]) returns [1, 2, 3, 4]
   */
  Flatten: (value: any) => {
    assertArray(value, 'Transformer.Array.Flatten')
    return value.flat()
  },
})
