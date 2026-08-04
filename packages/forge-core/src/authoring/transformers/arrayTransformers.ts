import { assertArray, assertNumber, assertString } from '../../shared/utils/asserts'
import TransformerRegistry from '../registries/TransformerRegistry'

const arrayTransformers = new TransformerRegistry()

export const ArrayTransformers = {
  /**
   * Returns the length of the array
   * @example
   * // Length() applied to [1, 2, 3, 4] returns 4
   */
  Length: arrayTransformers.register('Array.Length', () => (value: any) => {
    assertArray(value, 'Transformer.Array.Length')
    return value.length
  }),

  /**
   * Returns the first element of the array
   * @example
   * // First() applied to [1, 2, 3] returns 1
   */
  First: arrayTransformers.register('Array.First', () => (value: any) => {
    assertArray(value, 'Transformer.Array.First')
    return value.length > 0 ? value[0] : undefined
  }),

  /**
   * Returns the last element of the array
   * @example
   * // Last() applied to [1, 2, 3] returns 3
   */
  Last: arrayTransformers.register('Array.Last', () => (value: any) => {
    assertArray(value, 'Transformer.Array.Last')
    return value.length > 0 ? value[value.length - 1] : undefined
  }),

  /**
   * Reverses the array (returns a new array)
   * @example
   * // Reverse() applied to [1, 2, 3] returns [3, 2, 1]
   */
  Reverse: arrayTransformers.register('Array.Reverse', () => (value: any) => {
    assertArray(value, 'Transformer.Array.Reverse')
    return [...value].reverse()
  }),

  /**
   * Joins array elements into a string with specified separator
   * @param separator - Separator to place between elements (defaults to ',')
   * @example
   * // Join(", ") applied to [1, 2, 3] returns "1, 2, 3"
   */
  Join: arrayTransformers.register('Array.Join', () => (value: any, separator: string = ',') => {
    assertArray(value, 'Transformer.Array.Join')
    assertString(separator, 'Transformer.Array.Join (separator)')
    return value.join(separator)
  }),

  /**
   * Returns a slice of the array from start to end index
   * @param start - The zero-based index at which to begin extraction
   * @param end - The zero-based index before which to end extraction (optional)
   * @example
   * // Slice(1, 4) applied to [1, 2, 3, 4, 5] returns [2, 3, 4]
   */
  Slice: arrayTransformers.register('Array.Slice', () => (value: any, start: number, end?: number) => {
    assertArray(value, 'Transformer.Array.Slice')
    assertNumber(start, 'Transformer.Array.Slice (start)')
    if (end !== undefined) {
      assertNumber(end, 'Transformer.Array.Slice (end)')
      return value.slice(start, end)
    }
    return value.slice(start)
  }),

  /**
   * Concatenates arrays together
   * @param arrays - Additional arrays to concatenate to the input
   * @example
   * // Concat([3, 4]) applied to [1, 2] returns [1, 2, 3, 4]
   */
  Concat: arrayTransformers.register('Array.Concat', () => (value: any, ...arrays: any[][]) => {
    assertArray(value, 'Transformer.Array.Concat')
    arrays.forEach((arr, index) => {
      assertArray(arr, `Transformer.Array.Concat (array at position ${index + 1})`)
    })
    return value.concat(...arrays)
  }),

  /**
   * Returns unique elements from the array (removes duplicates)
   * @example
   * // Unique() applied to [1, 2, 2, 3, 1] returns [1, 2, 3]
   */
  Unique: arrayTransformers.register('Array.Unique', () => (value: any) => {
    assertArray(value, 'Transformer.Array.Unique')
    return [...new Set(value)]
  }),

  /**
   * Sorts the array in ascending order (returns a new array)
   * @example
   * // Sort() applied to [3, 1, 4, 2] returns [1, 2, 3, 4]
   */
  Sort: arrayTransformers.register('Array.Sort', () => (value: any) => {
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
   * @param filterValue - The value each element is compared against
   * @example
   * // Filter(2) applied to [1, 2, 2, 3] returns [2, 2]
   */
  Filter: arrayTransformers.register('Array.Filter', () => (value: any, filterValue: unknown) => {
    assertArray(value, 'Transformer.Array.Filter')
    return value.filter((item: any) => item === filterValue)
  }),

  /**
   * Maps each array element by extracting a property (for objects) or applying an index (for arrays)
   * @param property - The property name (for objects) or index (for nested arrays) to extract
   * @example
   * // Map('name') applied to [{name: 'John'}, {name: 'Jane'}] returns ['John', 'Jane']
   * // Map(0) applied to [[1, 2], [3, 4]] returns [1, 3]
   */
  Map: arrayTransformers.register('Array.Map', () => (value: any, property: string | number) => {
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
  }),

  /**
   * Flattens a nested array by one level
   * @example
   * // Flatten() applied to [[1, 2], [3, 4]] returns [1, 2, 3, 4]
   */
  Flatten: arrayTransformers.register('Array.Flatten', () => (value: any) => {
    assertArray(value, 'Transformer.Array.Flatten')
    return value.flat()
  }),
}

export { arrayTransformers as arrayTransformersRegistry }
