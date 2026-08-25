import { z } from 'zod'
import { transformer } from '../../../authoring/functions/transformer'

const arraySchema = z.array(z.unknown())

export const ArrayTransformers = {
  /**
   * Returns the length of the array
   * @example
   * // Length() applied to [1, 2, 3, 4] returns 4
   */
  Length: transformer('Array.Length', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) => value.length,
  }),

  /**
   * Returns the first element of the array
   * @example
   * // First() applied to [1, 2, 3] returns 1
   */
  First: transformer('Array.First', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) => (value.length > 0 ? value[0] : undefined),
  }),

  /**
   * Returns the last element of the array
   * @example
   * // Last() applied to [1, 2, 3] returns 3
   */
  Last: transformer('Array.Last', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) => (value.length > 0 ? value[value.length - 1] : undefined),
  }),

  /**
   * Reverses the array (returns a new array)
   * @example
   * // Reverse() applied to [1, 2, 3] returns [3, 2, 1]
   */
  Reverse: transformer('Array.Reverse', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) => [...value].reverse(),
  }),

  /**
   * Joins array elements into a string with specified separator
   * @param separator - Separator to place between elements (defaults to ',')
   * @example
   * // Join(", ") applied to [1, 2, 3] returns "1, 2, 3"
   */
  Join: transformer('Array.Join', {
    inputSchema: arraySchema,
    argumentsSchema: z.tuple([z.string().optional()]),
    factory:
      () =>
      (value: unknown[], separator: string = ',') =>
        value.join(separator),
  }),

  /**
   * Returns a slice of the array from start to end index
   * @param start - The zero-based index at which to begin extraction
   * @param end - The zero-based index before which to end extraction (optional)
   * @example
   * // Slice(1, 4) applied to [1, 2, 3, 4, 5] returns [2, 3, 4]
   */
  Slice: transformer('Array.Slice', {
    inputSchema: arraySchema,
    argumentsSchema: z.tuple([z.number(), z.number().optional()]),
    factory: () => (value: unknown[], start: number, end?: number) => value.slice(start, end),
  }),

  /**
   * Concatenates arrays together
   * @param arrays - Additional arrays to concatenate to the input
   * @example
   * // Concat([3, 4]) applied to [1, 2] returns [1, 2, 3, 4]
   */
  Concat: transformer('Array.Concat', {
    inputSchema: arraySchema,
    argumentsSchema: z.tuple([z.array(z.unknown())], z.array(z.unknown())),
    factory:
      () =>
      (value: unknown[], ...arrays: unknown[][]) =>
        value.concat(...arrays),
  }),

  /**
   * Returns unique elements from the array (removes duplicates)
   * @example
   * // Unique() applied to [1, 2, 2, 3, 1] returns [1, 2, 3]
   */
  Unique: transformer('Array.Unique', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) => [...new Set(value)],
  }),

  /**
   * Sorts the array in ascending order (returns a new array)
   * @example
   * // Sort() applied to [3, 1, 4, 2] returns [1, 2, 3, 4]
   */
  Sort: transformer('Array.Sort', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) =>
      [...value].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
          return a - b
        }

        return String(a).localeCompare(String(b))
      }),
  }),

  /**
   * Filters the array to only include elements that match the specified value
   * @param filterValue - The value each element is compared against
   * @example
   * // Filter(2) applied to [1, 2, 2, 3] returns [2, 2]
   */
  Filter: transformer('Array.Filter', {
    inputSchema: arraySchema,
    argumentsSchema: z.tuple([z.unknown()]),
    factory: () => (value: unknown[], filterValue: unknown) => value.filter(item => item === filterValue),
  }),

  /**
   * Removes null and undefined elements from the array (returns a new array)
   * @example
   * // Compact() applied to [1, null, 2, undefined, 3] returns [1, 2, 3]
   */
  Compact: transformer('Array.Compact', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) => value.filter(item => item !== null && item !== undefined),
  }),

  /**
   * Maps each array element by extracting a property (for objects) or applying an index (for arrays)
   * @param property - The property name (for objects) or index (for nested arrays) to extract
   * @example
   * // Map('name') applied to [{name: 'John'}, {name: 'Jane'}] returns ['John', 'Jane']
   * // Map(0) applied to [[1, 2], [3, 4]] returns [1, 3]
   */
  Map: transformer('Array.Map', {
    inputSchema: arraySchema,
    argumentsSchema: z.tuple([z.union([z.string(), z.number()])]),
    factory: () => (value: unknown[], property: string | number) =>
      value.map(item => {
        if (typeof property === 'number' && Array.isArray(item)) {
          return item[property]
        }

        if (typeof property === 'string' && typeof item === 'object' && item !== null) {
          return (item as Record<string, unknown>)[property]
        }

        return undefined
      }),
  }),

  /**
   * Flattens a nested array by one level
   * @example
   * // Flatten() applied to [[1, 2], [3, 4]] returns [1, 2, 3, 4]
   */
  Flatten: transformer('Array.Flatten', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[]) => value.flat(),
  }),
}
