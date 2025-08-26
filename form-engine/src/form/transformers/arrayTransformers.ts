import { buildTransformerFunction } from '../helpers/createRegisterableFunction'
import { assertArray } from '../conditions/asserts'

/**
 * Array transformation functions for manipulating collections of data
 */
export default {
  /**
   * Returns the length of the array
   * @example
   * // Length([1, 2, 3, 4]) returns 4
   */
  Length: buildTransformerFunction('length', (value: any) => {
    assertArray(value, 'Transformer.Array.Length')
    return value.length
  }),

  /**
   * Returns the first element of the array
   * @example
   * // First([1, 2, 3]) returns 1
   */
  First: buildTransformerFunction('first', (value: any) => {
    assertArray(value, 'Transformer.Array.First')
    return value.length > 0 ? value[0] : undefined
  }),

  /**
   * Returns the last element of the array
   * @example
   * // Last([1, 2, 3]) returns 3
   */
  Last: buildTransformerFunction('last', (value: any) => {
    assertArray(value, 'Transformer.Array.Last')
    return value.length > 0 ? value[value.length - 1] : undefined
  }),

  /**
   * Reverses the array (returns a new array)
   * @example
   * // Reverse([1, 2, 3]) returns [3, 2, 1]
   */
  Reverse: buildTransformerFunction('reverse', (value: any) => {
    assertArray(value, 'Transformer.Array.Reverse')
    return [...value].reverse()
  }),

  /**
   * Joins array elements into a string with specified separator
   * @example
   * // Join([1, 2, 3], ", ") returns "1, 2, 3"
   */
  Join: buildTransformerFunction('join', (value: any, separator: string = ',') => {
    assertArray(value, 'Transformer.Array.Join')
    return value.join(separator)
  }),

  /**
   * Returns a slice of the array from start to end index
   * @example
   * // Slice([1, 2, 3, 4, 5], 1, 4) returns [2, 3, 4]
   */
  Slice: buildTransformerFunction('slice', (value: any, start: number, end?: number) => {
    assertArray(value, 'Transformer.Array.Slice')
    return value.slice(start, end)
  }),

  /**
   * Concatenates arrays together
   * @example
   * // Concat([1, 2], [3, 4]) returns [1, 2, 3, 4]
   */
  Concat: buildTransformerFunction('concat', (value: any, ...arrays: any[][]) => {
    assertArray(value, 'Transformer.Array.Concat')
    arrays.forEach((arr, index) => {
      if (!Array.isArray(arr)) {
        throw new Error(`Expected array at position ${index + 1} for Transformer.Array.Concat`)
      }
    })
    return value.concat(...arrays)
  }),

  /**
   * Returns unique elements from the array (removes duplicates)
   * @example
   * // Unique([1, 2, 2, 3, 1]) returns [1, 2, 3]
   */
  Unique: buildTransformerFunction('unique', (value: any) => {
    assertArray(value, 'Transformer.Array.Unique')
    return [...new Set(value)]
  }),

  /**
   * Sorts the array in ascending order (returns a new array)
   * @example
   * // Sort([3, 1, 4, 2]) returns [1, 2, 3, 4]
   */
  Sort: buildTransformerFunction('sort', (value: any) => {
    assertArray(value, 'Transformer.Array.Sort')
    return [...value].sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b
      }
      return String(a).localeCompare(String(b))
    })
  }),

  /**
   * Filters the array to only include elements that match the specified value
   * @example
   * // Filter([1, 2, 2, 3], 2) returns [2, 2]
   */
  Filter: buildTransformerFunction('filter', (value: any, filterValue: any) => {
    assertArray(value, 'Transformer.Array.Filter')
    return value.filter((item: any) => item === filterValue)
  }),

  /**
   * Maps each array element by extracting a property (for objects) or applying an index (for arrays)
   * @example
   * // Map([{name: 'John'}, {name: 'Jane'}], 'name') returns ['John', 'Jane']
   * // Map([[1, 2], [3, 4]], 0) returns [1, 3]
   */
  Map: buildTransformerFunction('map', (value: any, property: string | number) => {
    assertArray(value, 'Transformer.Array.Map')
    return value.map((item: any) => {
      if (typeof property === 'number' && Array.isArray(item)) {
        return item[property]
      }
      if (typeof property === 'string' && typeof item === 'object' && item !== null) {
        return item[property]
      }
      return undefined
    })
  }),

  /**
   * Flattens a nested array by one level
   * @example
   * // Flatten([[1, 2], [3, 4]]) returns [1, 2, 3, 4]
   */
  Flatten: buildTransformerFunction('flatten', (value: any) => {
    assertArray(value, 'Transformer.Array.Flatten')
    return value.flat()
  }),
}
