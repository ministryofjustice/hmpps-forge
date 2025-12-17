import { assertNumber, assertString } from '@form-engine/registry/utils/asserts'
import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'
import { ValueExpr } from '@form-engine/form/types/expressions.type'

/**
 * String transformation functions for data processing
 *
 * All config arguments accept both static values and expressions:
 * - Static: Transformer.String.Substring(0, 5)
 * - Dynamic: Transformer.String.Replace(Answer('search'), Answer('replace'))
 */
export const { transformers: StringTransformers, registry: StringTransformersRegistry } = defineTransformers({
  /**
   * Removes whitespace from both ends of a string
   * @example
   * // Transforms "  hello world  " to "hello world"
   */
  Trim: (value: any) => {
    assertString(value, 'Transformer.String.Trim')
    return value.trim()
  },

  /**
   * Converts string to uppercase
   * @example
   * // Transforms "Hello World" to "HELLO WORLD"
   */
  ToUpperCase: (value: any) => {
    assertString(value, 'Transformer.String.ToUpperCase')
    return value.toUpperCase()
  },

  /**
   * Converts string to lowercase
   * @example
   * // Transforms "Hello World" to "hello world"
   */
  ToLowerCase: (value: any) => {
    assertString(value, 'Transformer.String.ToLowerCase')
    return value.toLowerCase()
  },

  /**
   * Capitalizes the first letter of each word
   * @example
   * // Transforms "hello world" to "Hello World"
   */
  ToTitleCase: (value: any) => {
    assertString(value, 'Transformer.String.ToTitleCase')
    return value.replace(/\w\S*/g, text => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase())
  },

  /**
   * Capitalizes the first letter of the string
   * @example
   * // Transforms "hello world" to "Hello world"
   */
  Capitalize: (value: any) => {
    assertString(value, 'Transformer.String.Capitalize')
    if (value.length === 0) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  },

  /**
   * Extracts a substring from start to end position
   * @example
   * // Substring("hello", 1, 4) returns "ell"
   */
  Substring: (value: any, start: number | ValueExpr, end?: number | ValueExpr) => {
    assertString(value, 'Transformer.String.Substring')
    assertNumber(start, 'Transformer.String.Substring (start)')
    if (end !== undefined) {
      assertNumber(end, 'Transformer.String.Substring (end)')
      return value.substring(start, end)
    }
    return value.substring(start)
  },

  /**
   * Replaces all occurrences of a search string with a replacement string
   * @example
   * // Replace("hello world", "world", "universe") returns "hello universe"
   */
  Replace: (value: any, searchValue: string | ValueExpr, replaceValue: string | ValueExpr) => {
    assertString(value, 'Transformer.String.Replace')
    assertString(searchValue, 'Transformer.String.Replace (searchValue)')
    assertString(replaceValue, 'Transformer.String.Replace (replaceValue)')
    return value.replaceAll(searchValue, replaceValue)
  },

  /**
   * Pads the string to a specified length with spaces on the left
   * @example
   * // PadStart("5", 3) returns "  5"
   */
  PadStart: (value: any, targetLength: number | ValueExpr, padString: string | ValueExpr = ' ') => {
    assertString(value, 'Transformer.String.PadStart')
    assertNumber(targetLength, 'Transformer.String.PadStart (targetLength)')
    assertString(padString, 'Transformer.String.PadStart (padString)')
    return value.padStart(targetLength, padString)
  },

  /**
   * Pads the string to a specified length with spaces on the right
   * @example
   * // PadEnd("5", 3) returns "5  "
   */
  PadEnd: (value: any, targetLength: number | ValueExpr, padString: string | ValueExpr = ' ') => {
    assertString(value, 'Transformer.String.PadEnd')
    assertNumber(targetLength, 'Transformer.String.PadEnd (targetLength)')
    assertString(padString, 'Transformer.String.PadEnd (padString)')
    return value.padEnd(targetLength, padString)
  },

  /**
   * TODO: I wonder if the below transformers should instead be broken off into a `Type` transformer group, like
   *  `Transformers.Type.ToInt()` - it might be a bit more clear.
   */

  /**
   * Converts a string to an integer
   * Throws on invalid input so pipeline errors and original value is preserved.
   * @example
   * // ToInt("123") returns 123
   * // ToInt("123.45") returns 123 (truncated)
   * // ToInt("  123  ") returns 123
   * // ToInt("") throws Error
   * // ToInt("abc") throws Error
   * // ToInt("123abc") throws Error (partial parse rejected)
   */
  ToInt: (value: any) => {
    assertString(value, 'Transformer.String.ToInt')

    const trimmed = value.trim()
    const parsed = Number(trimmed)

    if (trimmed === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      throw new Error(`Transformer.String.ToInt: "${value}" is not a valid number`)
    }

    return Math.trunc(parsed)
  },

  /**
   * Converts a string to a floating-point number
   * Throws on invalid input so pipeline errors and original value is preserved.
   * @example
   * // ToFloat("123.45") returns 123.45
   * // ToFloat("3.14159") returns 3.14159
   * // ToFloat("  123.45  ") returns 123.45
   * // ToFloat("") throws Error
   * // ToFloat("abc") throws Error
   * // ToFloat("123abc") throws Error (partial parse rejected)
   */
  ToFloat: (value: any) => {
    assertString(value, 'Transformer.String.ToFloat')

    const trimmed = value.trim()
    const parsed = Number(trimmed)

    if (trimmed === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      throw new Error(`Transformer.String.ToFloat: "${value}" is not a valid number`)
    }

    return parsed
  },

  /**
   * Splits a string into an array of characters or by a separator
   * @example
   * // ToArray("hello") returns ["h", "e", "l", "l", "o"]
   * // ToArray("hello,world", ",") returns ["hello", "world"]
   * // ToArray("a-b-c", "-") returns ["a", "b", "c"]
   */
  ToArray: (value: any, separator?: string | ValueExpr) => {
    assertString(value, 'Transformer.String.ToArray')
    if (separator === undefined) {
      return value.split('')
    }
    assertString(separator, 'Transformer.String.ToArray (separator)')
    return value.split(separator)
  },

  /**
   * Converts a UK-formatted date string to a Date (local time).
   * Throws on invalid input so pipeline errors and original value is preserved.
   *
   * //TODO: This probably needs to support supplying/choosing a format.
   * @example
   * // ToDate("15/03/2024") -> 2024-03-15T00:00:00 local
   * // ToDate("15-03-2024") -> 2024-03-15T00:00:00 local
   * // ToDate("2024-03-15") -> throws Error (ISO format not supported)
   * // ToDate("") -> throws Error
   */
  ToDate: (value: any) => {
    const UK_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
    assertString(value, 'Transformer.String.ToDate')

    const trimmed = value.trim()

    if (!trimmed) {
      throw new Error(`Transformer.String.ToDate: "${value}" is not a valid date`)
    }

    const match = UK_DATE_RE.exec(trimmed)

    if (!match) {
      throw new Error(`Transformer.String.ToDate: "${value}" is not a valid UK date (expected DD/MM/YYYY)`)
    }

    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    const date = new Date(year, month - 1, day)

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error(`Transformer.String.ToDate: "${value}" is not a valid date`)
    }

    return date
  },

  /**
   * Converts a UK-formatted date string (DD/MM/YYYY) to ISO-8601 format (YYYY-MM-DD).
   * Throws on invalid input so pipeline errors and original value is preserved.
   *
   * Use this with MOJ Date Picker which outputs UK format dates.
   * @example
   * // ToISODate("15/03/2024") -> "2024-03-15"
   * // ToISODate("5/3/2024") -> "2024-03-05"
   * // ToISODate("15-03-2024") -> "2024-03-15"
   * // ToISODate("") -> throws Error
   * // ToISODate("31/02/2024") -> throws Error (invalid date)
   */
  ToISODate: (value: any) => {
    const UK_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
    assertString(value, 'Transformer.String.ToISODate')

    const trimmed = value.trim()

    if (!trimmed) {
      throw new Error(`Transformer.String.ToISODate: "${value}" is not a valid date`)
    }

    const match = UK_DATE_RE.exec(trimmed)

    if (!match) {
      throw new Error(`Transformer.String.ToISODate: "${value}" is not a valid UK date (expected DD/MM/YYYY)`)
    }

    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    // Validate the date is real (handles leap years, month lengths, etc.)
    const date = new Date(year, month - 1, day)

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error(`Transformer.String.ToISODate: "${value}" is not a valid date`)
    }

    // Format as ISO-8601: YYYY-MM-DD
    const paddedYear = String(year).padStart(4, '0')
    const paddedMonth = String(month).padStart(2, '0')
    const paddedDay = String(day).padStart(2, '0')

    return `${paddedYear}-${paddedMonth}-${paddedDay}`
  },
})
