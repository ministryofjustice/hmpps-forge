import { assertNumber, assertString } from '../../shared/utils/asserts'
import { createFunctionsRegistry } from '../utils/createFunctionsRegistry'
import { defineTransformerFunctions } from '../utils/defineTransformerFunctions'
import { TransformerFunctionExpr, ResolvableValue } from '../types/expressions.type'
import { escapeHtmlEntities } from '../../shared/utils/sanitize'

const DEFAULT_FORMAT_DATE_LOCALE = 'en-GB'
const DEFAULT_FORMAT_DATE_TIME_ZONE = 'Europe/London'
const DEFAULT_FORMAT_DATE_OPTIONS: StringDateFormatOptions = {
  dateStyle: 'long',
}

type StringDateFormatOptions = Readonly<
  Intl.DateTimeFormatOptions & {
    locale?: string
  }
>

const assertStringDateFormatOptions: (
  value: unknown,
  functionName: string,
) => asserts value is StringDateFormatOptions | undefined = (value, functionName) => {
  if (value === undefined) {
    return
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${functionName} expects an options object but received ${typeof value}.`)
  }
}

const parseDateString = (value: string, functionName: string): Date => {
  const UK_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
  const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/
  const trimmed = value.trim()

  if (!trimmed) {
    throw new TypeError(`${functionName}: "${value}" is not a valid date`)
  }

  const ukMatch = UK_DATE_RE.exec(trimmed)

  if (ukMatch) {
    const day = Number(ukMatch[1])
    const month = Number(ukMatch[2])
    const year = Number(ukMatch[3])

    const date = new Date(year, month - 1, day)

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new TypeError(`${functionName}: "${value}" is not a valid date`)
    }

    return date
  }

  const isoMatch = ISO_DATE_RE.exec(trimmed)

  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    const dateOnly = new Date(Date.UTC(year, month - 1, day))

    if (dateOnly.getUTCFullYear() !== year || dateOnly.getUTCMonth() !== month - 1 || dateOnly.getUTCDate() !== day) {
      throw new TypeError(`${functionName}: "${value}" is not a valid date`)
    }

    if (!trimmed.includes('T')) {
      return dateOnly
    }

    const dateTime = new Date(trimmed)

    if (Number.isNaN(dateTime.getTime())) {
      throw new TypeError(`${functionName}: "${value}" is not a valid ISO date`)
    }

    return dateTime
  }

  throw new TypeError(`${functionName}: "${value}" is not a valid date (expected DD/MM/YYYY or YYYY-MM-DD)`)
}

/**
 * String transformation functions for data processing
 *
 * All config arguments accept both static values and expressions:
 * - Static: Transformer.String.Substring(0, 5)
 * - Dynamic: Transformer.String.Replace(Answer('search'), Answer('replace'))
 */
export interface StringTransformerGroup {
  /**
   * Removes whitespace from both ends of a string
   * @example
   * // Transforms "  hello world  " to "hello world"
   */
  Trim: () => TransformerFunctionExpr

  /**
   * Converts string to uppercase
   * @example
   * // Transforms "Hello World" to "HELLO WORLD"
   */
  ToUpperCase: () => TransformerFunctionExpr

  /**
   * Converts string to lowercase
   * @example
   * // Transforms "Hello World" to "hello world"
   */
  ToLowerCase: () => TransformerFunctionExpr

  /**
   * Capitalizes the first letter of each word
   * @example
   * // Transforms "hello world" to "Hello World"
   */
  ToTitleCase: () => TransformerFunctionExpr

  /**
   * Capitalizes the first letter of the string
   * @example
   * // Transforms "hello world" to "Hello world"
   */
  Capitalize: () => TransformerFunctionExpr

  /**
   * Converts a name to its possessive form
   * Names ending in 's' get just an apostrophe, others get 's
   * @example
   * // Possessive("John") returns "John's"
   * // Possessive("James") returns "James'"
   * // Possessive("Chris") returns "Chris'"
   */
  Possessive: () => TransformerFunctionExpr

  /**
   * Extracts a substring from start to end position
   * @param start - The zero-based index at which to begin extraction
   * @param end - The zero-based index before which to end extraction (optional)
   * @example
   * // Substring(1, 4) applied to "hello" returns "ell"
   */
  Substring: (start: number | ResolvableValue, end?: number | ResolvableValue) => TransformerFunctionExpr

  /**
   * Replaces all occurrences of a search string with a replacement string
   * @param searchValue - The string to search for
   * @param replaceValue - The string to replace matches with
   * @example
   * // Replace("world", "universe") applied to "hello world" returns "hello universe"
   */
  Replace: (searchValue: string | ResolvableValue, replaceValue: string | ResolvableValue) => TransformerFunctionExpr

  /**
   * Pads the string to a specified length with a given string on the left
   * @param targetLength - The length the string should be padded to
   * @param padString - The string to pad with (defaults to a single space)
   * @example
   * // PadStart(3) applied to "5" returns "  5"
   */
  PadStart: (targetLength: number | ResolvableValue, padString?: string | ResolvableValue) => TransformerFunctionExpr

  /**
   * Pads the string to a specified length with a given string on the right
   * @param targetLength - The length the string should be padded to
   * @param padString - The string to pad with (defaults to a single space)
   * @example
   * // PadEnd(3) applied to "5" returns "5  "
   */
  PadEnd: (targetLength: number | ResolvableValue, padString?: string | ResolvableValue) => TransformerFunctionExpr

  /**
   * Converts a string to an integer
   * Throws on invalid input so the pipeline errors and the original value is preserved.
   * @example
   * // ToInt() on "123" returns 123
   * // ToInt() on "123.45" returns 123 (truncated)
   * // ToInt() on "  123  " returns 123
   * // ToInt() on "" throws Error
   * // ToInt() on "abc" throws Error
   * // ToInt() on "123abc" throws Error (partial parse rejected)
   */
  ToInt: () => TransformerFunctionExpr

  /**
   * Converts a string to a floating-point number
   * Throws on invalid input so the pipeline errors and the original value is preserved.
   * @example
   * // ToFloat() on "123.45" returns 123.45
   * // ToFloat() on "3.14159" returns 3.14159
   * // ToFloat() on "  123.45  " returns 123.45
   * // ToFloat() on "" throws Error
   * // ToFloat() on "abc" throws Error
   * // ToFloat() on "123abc" throws Error (partial parse rejected)
   */
  ToFloat: () => TransformerFunctionExpr

  /**
   * Splits a string into an array of characters or by a separator
   * @param separator - Optional separator string; if omitted, splits into individual characters
   * @example
   * // ToArray() on "hello" returns ["h", "e", "l", "l", "o"]
   * // ToArray(",") on "hello,world" returns ["hello", "world"]
   * // ToArray("-") on "a-b-c" returns ["a", "b", "c"]
   */
  ToArray: (separator?: string | ResolvableValue) => TransformerFunctionExpr

  /**
   * Converts a date string to a Date object (local time).
   * Supports both UK format (DD/MM/YYYY) and ISO-8601 format (YYYY-MM-DD or full ISO with time/timezone).
   * Throws on invalid input so the pipeline errors and the original value is preserved.
   *
   * @example
   * // ToDate() on "15/03/2024" returns 2024-03-15T00:00:00 local
   * // ToDate() on "15-03-2024" returns 2024-03-15T00:00:00 local
   * // ToDate() on "2024-03-15" returns 2024-03-15T00:00:00 local
   * // ToDate() on "2024-03-15T14:30:00Z" returns a Date object with time
   * // ToDate() on "" throws Error
   */
  ToDate: () => TransformerFunctionExpr

  /**
   * Formats a date string using Intl.DateTimeFormat options.
   * Defaults to UK long date formatting when no options are supplied.
   *
   * @param options - Intl.DateTimeFormat options plus optional locale, which defaults to en-GB
   * @example
   * // FormatDate() on "2024-03-15" returns "15 March 2024"
   * // FormatDate({ dateStyle: 'short' }) on "2024-03-15" returns "15/03/2024"
   * // FormatDate({ locale: 'en-US', dateStyle: 'long' }) on "2024-03-15" returns "March 15, 2024"
   */
  FormatDate: (options?: StringDateFormatOptions) => TransformerFunctionExpr

  /**
   * Converts a UK-formatted date string (DD/MM/YYYY) to ISO-8601 format (YYYY-MM-DD).
   * Throws on invalid input so the pipeline errors and the original value is preserved.
   *
   * Use this with MOJ Date Picker which outputs UK format dates.
   * @example
   * // ToISODate() on "15/03/2024" returns "2024-03-15"
   * // ToISODate() on "5/3/2024" returns "2024-03-05"
   * // ToISODate() on "15-03-2024" returns "2024-03-15"
   * // ToISODate() on "" throws Error
   * // ToISODate() on "31/02/2024" throws Error (invalid date)
   */
  ToISODate: () => TransformerFunctionExpr

  /**
   * Converts an epoch millisecond date string to a Date (local time).
   * Throws on invalid input so the pipeline errors and the original value is preserved.
   *
   * @example
   * // ToTimestampDate() on "1771429146000" returns 2026-02-18T15:39:06 local
   * // ToTimestampDate() on "" throws Error
   */
  ToTimestampDate: () => TransformerFunctionExpr

  /**
   * Escapes HTML entities in a string to prevent XSS attacks.
   * Use this when piping untrusted data (user input, external API data) into HTML contexts.
   *
   * Converts: < > & " ' to their HTML entity equivalents.
   *
   * @example
   * // EscapeHtml() on '"><img src=x onerror=alert(1)>' returns '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'
   * // Usage: Data('goalTitle').pipe(Transformer.String.EscapeHtml())
   */
  EscapeHtml: () => TransformerFunctionExpr
}

const { transformers: StringTransformers, implementations } = defineTransformerFunctions<StringTransformerGroup>({
  Trim: () => (value: any) => {
    assertString(value, 'Transformer.String.Trim')
    return value.trim()
  },

  ToUpperCase: () => (value: any) => {
    assertString(value, 'Transformer.String.ToUpperCase')
    return value.toUpperCase()
  },

  ToLowerCase: () => (value: any) => {
    assertString(value, 'Transformer.String.ToLowerCase')
    return value.toLowerCase()
  },

  ToTitleCase: () => (value: any) => {
    assertString(value, 'Transformer.String.ToTitleCase')
    return value.replace(/\w\S*/g, text => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase())
  },

  Capitalize: () => (value: any) => {
    assertString(value, 'Transformer.String.Capitalize')
    if (value.length === 0) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  },

  Possessive: () => (value: any) => {
    assertString(value, 'Transformer.String.Possessive')
    if (value.length === 0) return value
    if (value.toLowerCase().endsWith('s')) {
      return `${value}'`
    }
    return `${value}'s`
  },

  Substring: () => (value: any, start: number | ResolvableValue, end?: number | ResolvableValue) => {
    assertString(value, 'Transformer.String.Substring')
    assertNumber(start, 'Transformer.String.Substring (start)')
    if (end !== undefined) {
      assertNumber(end, 'Transformer.String.Substring (end)')
      return value.substring(start, end)
    }
    return value.substring(start)
  },

  Replace: () => (value: any, searchValue: string | ResolvableValue, replaceValue: string | ResolvableValue) => {
    assertString(value, 'Transformer.String.Replace')
    assertString(searchValue, 'Transformer.String.Replace (searchValue)')
    assertString(replaceValue, 'Transformer.String.Replace (replaceValue)')
    return value.replaceAll(searchValue, replaceValue)
  },

  PadStart:
    () =>
    (value: any, targetLength: number | ResolvableValue, padString: string | ResolvableValue = ' ') => {
      assertString(value, 'Transformer.String.PadStart')
      assertNumber(targetLength, 'Transformer.String.PadStart (targetLength)')
      assertString(padString, 'Transformer.String.PadStart (padString)')
      return value.padStart(targetLength, padString)
    },

  PadEnd:
    () =>
    (value: any, targetLength: number | ResolvableValue, padString: string | ResolvableValue = ' ') => {
      assertString(value, 'Transformer.String.PadEnd')
      assertNumber(targetLength, 'Transformer.String.PadEnd (targetLength)')
      assertString(padString, 'Transformer.String.PadEnd (padString)')
      return value.padEnd(targetLength, padString)
    },

  // TODO: I wonder if the below transformers should instead be broken off into a `Type` transformer group, like
  //  `Transformers.Type.ToInt()` - it might be a bit more clear.
  ToInt: () => (value: any) => {
    assertString(value, 'Transformer.String.ToInt')

    const trimmed = value.trim()
    const parsed = Number(trimmed)

    if (trimmed === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      throw new TypeError(`Transformer.String.ToInt: "${value}" is not a valid number`)
    }

    return Math.trunc(parsed)
  },

  ToFloat: () => (value: any) => {
    assertString(value, 'Transformer.String.ToFloat')

    const trimmed = value.trim()
    const parsed = Number(trimmed)

    if (trimmed === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      throw new TypeError(`Transformer.String.ToFloat: "${value}" is not a valid number`)
    }

    return parsed
  },

  ToArray: () => (value: any, separator?: string | ResolvableValue) => {
    assertString(value, 'Transformer.String.ToArray')
    if (separator === undefined) {
      return value.split('')
    }
    assertString(separator, 'Transformer.String.ToArray (separator)')
    return value.split(separator)
  },

  // TODO: This probably needs to support supplying/choosing a format.
  ToDate: () => (value: unknown) => {
    assertString(value, 'Transformer.String.ToDate')

    return parseDateString(value, 'Transformer.String.ToDate')
  },

  FormatDate: () => (value: unknown, options?: StringDateFormatOptions) => {
    assertString(value, 'Transformer.String.FormatDate')
    assertStringDateFormatOptions(options, 'Transformer.String.FormatDate')

    const {
      locale = DEFAULT_FORMAT_DATE_LOCALE,
      timeZone = DEFAULT_FORMAT_DATE_TIME_ZONE,
      ...dateTimeFormatOptions
    } = options ?? DEFAULT_FORMAT_DATE_OPTIONS

    assertString(locale, 'Transformer.String.FormatDate (locale)')
    assertString(timeZone, 'Transformer.String.FormatDate (timeZone)')

    const date = parseDateString(value, 'Transformer.String.FormatDate')

    return new Intl.DateTimeFormat(locale, { ...dateTimeFormatOptions, timeZone }).format(date)
  },

  ToISODate: () => (value: any) => {
    const UK_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
    assertString(value, 'Transformer.String.ToISODate')

    const trimmed = value.trim()

    if (!trimmed) {
      throw new TypeError(`Transformer.String.ToISODate: "${value}" is not a valid date`)
    }

    const match = UK_DATE_RE.exec(trimmed)

    if (!match) {
      throw new TypeError(`Transformer.String.ToISODate: "${value}" is not a valid UK date (expected DD/MM/YYYY)`)
    }

    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    const date = new Date(year, month - 1, day)

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new TypeError(`Transformer.String.ToISODate: "${value}" is not a valid date`)
    }

    const paddedYear = String(year).padStart(4, '0')
    const paddedMonth = String(month).padStart(2, '0')
    const paddedDay = String(day).padStart(2, '0')

    return `${paddedYear}-${paddedMonth}-${paddedDay}`
  },

  ToTimestampDate: () => (value: any) => {
    assertString(value, 'Transformer.String.ToTimestampDate')

    if (!/^\d+$/.test(value)) {
      throw new TypeError(`Transformer.String.ToTimestampDate: "${value}" is not a timestamp`)
    }

    const epoch = Number(value)

    if (!Number.isSafeInteger(epoch)) {
      throw new TypeError(`Transformer.String.ToTimestampDate: "${value}" is not a valid timestamp`)
    }

    const date = new Date(epoch)

    if (Number.isNaN(date.getTime())) {
      throw new TypeError(`Transformer.String.ToTimestampDate: "${value}" is not a valid epoch timestamp`)
    }

    return date
  },

  EscapeHtml: () => (value: any) => {
    assertString(value, 'Transformer.String.EscapeHtml')

    return escapeHtmlEntities(value)
  },
})

const StringTransformersRegistry = createFunctionsRegistry(implementations)

export { StringTransformers, StringTransformersRegistry }
