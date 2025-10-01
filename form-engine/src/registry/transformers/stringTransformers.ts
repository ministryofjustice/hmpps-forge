import { assertString } from '@form-engine/registry/utils/asserts'
import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'

/**
 * String transformation functions for data processing
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
  Substring: (value: any, start: number, end?: number) => {
    assertString(value, 'Transformer.String.Substring')
    return value.substring(start, end)
  },

  /**
   * Replaces all occurrences of a search string with a replacement string
   * @example
   * // Replace("hello world", "world", "universe") returns "hello universe"
   */
  Replace: (value: any, searchValue: string, replaceValue: string) => {
    assertString(value, 'Transformer.String.Replace')
    return value.replaceAll(searchValue, replaceValue)
  },

  /**
   * Pads the string to a specified length with spaces on the left
   * @example
   * // PadStart("5", 3) returns "  5"
   */
  PadStart: (value: any, targetLength: number, padString: string = ' ') => {
    assertString(value, 'Transformer.String.PadStart')
    return value.padStart(targetLength, padString)
  },

  /**
   * Pads the string to a specified length with spaces on the right
   * @example
   * // PadEnd("5", 3) returns "5  "
   */
  PadEnd: (value: any, targetLength: number, padString: string = ' ') => {
    assertString(value, 'Transformer.String.PadEnd')
    return value.padEnd(targetLength, padString)
  },

  /**
   * TODO: I wonder if the below transformers should instead be broken off into a `Type` transformer group, like
   *  `Transformers.Type.ToInt()` - it might be a bit more clear.
   */

  /**
   * Converts a string to an integer
   * @example
   * // ToInt("123") returns 123
   * // ToInt("123.45") returns 123
   * // ToInt("0xFF") returns 255 (hexadecimal)
   * // ToInt("not a number") returns NaN
   */
  ToInt: (value: any, radix: number = 10) => {
    assertString(value, 'Transformer.String.ToInt')
    return parseInt(value, radix)
  },

  /**
   * Converts a string to a floating-point number
   * @example
   * // ToFloat("123.45") returns 123.45
   * // ToFloat("3.14159") returns 3.14159
   * // ToFloat("not a number") returns NaN
   */
  ToFloat: (value: any) => {
    assertString(value, 'Transformer.String.ToFloat')
    return parseFloat(value)
  },

  /**
   * Splits a string into an array of characters or by a separator
   * @example
   * // ToArray("hello") returns ["h", "e", "l", "l", "o"]
   * // ToArray("hello,world", ",") returns ["hello", "world"]
   * // ToArray("a-b-c", "-") returns ["a", "b", "c"]
   */
  ToArray: (value: any, separator?: string) => {
    assertString(value, 'Transformer.String.ToArray')
    if (separator === undefined) {
      return value.split('')
    }
    return value.split(separator)
  },

  /**
   * Converts a UK-formatted date string to a Date (local time).
   * Returns Invalid Date if the input is empty or not a valid UK date
   *
   * //TODO: This probably needs to support supplying/choosing a format.
   * @example
   * // ToDate("15/03/2024") -> 2024-03-15T00:00:00 local
   * // ToDate("15-03-2024") -> 2024-03-15T00:00:00 local
   * // ToDate("2024-03-15") -> Invalid Date
   */
  ToDate: (value: any) => {
    const UK_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
    assertString(value, 'Transformer.String.ToDate')

    const trimString = value.trim()
    if (!trimString) {
      return new Date(NaN)
    }

    const matchString = UK_DATE_RE.exec(trimString)
    if (!matchString) {
      return new Date(NaN)
    }

    const day = Number(matchString[1])
    const month = Number(matchString[2])
    const year = Number(matchString[3])

    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : new Date(NaN)
  },
})
