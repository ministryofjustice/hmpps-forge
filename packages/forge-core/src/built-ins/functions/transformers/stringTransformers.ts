import { z } from 'zod'
import TransformerRegistry from '../../../authoring/registries/TransformerRegistry'
import { escapeHtmlEntities } from '../../sanitize'

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

const stringSchema = z.string()
const formatDateOptionsSchema = z.looseObject({
  locale: z.string().optional(),
  timeZone: z.string().optional(),
})

const stringTransformers = new TransformerRegistry()

export const StringTransformers = {
  /**
   * Removes whitespace from both ends of a string
   * @example
   * // Transforms "  hello world  " to "hello world"
   */
  Trim: stringTransformers.register('String.Trim', {
    inputSchema: stringSchema,
    factory: () => (value: string) => value.trim(),
  }),

  /**
   * Converts string to uppercase
   * @example
   * // Transforms "Hello World" to "HELLO WORLD"
   */
  ToUpperCase: stringTransformers.register('String.ToUpperCase', {
    inputSchema: stringSchema,
    factory: () => (value: string) => value.toUpperCase(),
  }),

  /**
   * Converts string to lowercase
   * @example
   * // Transforms "Hello World" to "hello world"
   */
  ToLowerCase: stringTransformers.register('String.ToLowerCase', {
    inputSchema: stringSchema,
    factory: () => (value: string) => value.toLowerCase(),
  }),

  /**
   * Capitalizes the first letter of each word
   * @example
   * // Transforms "hello world" to "Hello World"
   */
  ToTitleCase: stringTransformers.register('String.ToTitleCase', {
    inputSchema: stringSchema,
    factory: () => (value: string) =>
      value.replace(/\w\S*/g, (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()),
  }),

  /**
   * Capitalizes the first letter of the string
   * @example
   * // Transforms "hello world" to "Hello world"
   */
  Capitalize: stringTransformers.register('String.Capitalize', {
    inputSchema: stringSchema,
    factory: () => (value: string) => {
      if (value.length === 0) return value
      return value.charAt(0).toUpperCase() + value.slice(1)
    },
  }),

  /**
   * Converts a name to its possessive form
   * Names ending in 's' get just an apostrophe, others get 's
   * @example
   * // Possessive("John") returns "John's"
   * // Possessive("James") returns "James'"
   * // Possessive("Chris") returns "Chris'"
   */
  Possessive: stringTransformers.register('String.Possessive', {
    inputSchema: stringSchema,
    factory: () => (value: string) => {
      if (value.length === 0) return value
      if (value.toLowerCase().endsWith('s')) {
        return `${value}'`
      }
      return `${value}'s`
    },
  }),

  /**
   * Extracts a substring from start to end position
   * @param start - The zero-based index at which to begin extraction
   * @param end - The zero-based index before which to end extraction (optional)
   * @example
   * // Substring(1, 4) applied to "hello" returns "ell"
   */
  Substring: stringTransformers.register('String.Substring', {
    inputSchema: stringSchema,
    argumentsSchema: z.tuple([z.number(), z.number().optional()]),
    factory: () => (value: string, start: number, end?: number) => value.substring(start, end),
  }),

  /**
   * Replaces all occurrences of a search string with a replacement string
   * @param searchValue - The string to search for
   * @param replaceValue - The string to replace matches with
   * @example
   * // Replace("world", "universe") applied to "hello world" returns "hello universe"
   */
  Replace: stringTransformers.register('String.Replace', {
    inputSchema: stringSchema,
    argumentsSchema: z.tuple([z.string(), z.string()]),
    factory: () => (value: string, searchValue: string, replaceValue: string) =>
      value.replaceAll(searchValue, replaceValue),
  }),

  /**
   * Pads the string to a specified length with a given string on the left
   * @param targetLength - The length the string should be padded to
   * @param padString - The string to pad with (defaults to a single space)
   * @example
   * // PadStart(3) applied to "5" returns "  5"
   */
  PadStart: stringTransformers.register('String.PadStart', {
    inputSchema: stringSchema,
    argumentsSchema: z.tuple([z.number(), z.string().optional()]),
    factory:
      () =>
      (value: string, targetLength: number, padString: string = ' ') =>
        value.padStart(targetLength, padString),
  }),

  /**
   * Pads the string to a specified length with a given string on the right
   * @param targetLength - The length the string should be padded to
   * @param padString - The string to pad with (defaults to a single space)
   * @example
   * // PadEnd(3) applied to "5" returns "5  "
   */
  PadEnd: stringTransformers.register('String.PadEnd', {
    inputSchema: stringSchema,
    argumentsSchema: z.tuple([z.number(), z.string().optional()]),
    factory:
      () =>
      (value: string, targetLength: number, padString: string = ' ') =>
        value.padEnd(targetLength, padString),
  }),

  // TODO: I wonder if the below transformers should instead be broken off into a `Type` transformer group, like
  //  `Transformers.Type.ToInt()` - it might be a bit more clear.
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
  ToInt: stringTransformers.register('String.ToInt', {
    inputSchema: stringSchema,
    factory: () => (value: string) => {
      const trimmed = value.trim()
      const parsed = Number(trimmed)

      if (trimmed === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new TypeError(`Transformer.String.ToInt: "${value}" is not a valid number`)
      }

      return Math.trunc(parsed)
    },
  }),

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
  ToFloat: stringTransformers.register('String.ToFloat', {
    inputSchema: stringSchema,
    factory: () => (value: string) => {
      const trimmed = value.trim()
      const parsed = Number(trimmed)

      if (trimmed === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new TypeError(`Transformer.String.ToFloat: "${value}" is not a valid number`)
      }

      return parsed
    },
  }),

  /**
   * Splits a string into an array of characters or by a separator
   * @param separator - Optional separator string; if omitted, splits into individual characters
   * @example
   * // ToArray() on "hello" returns ["h", "e", "l", "l", "o"]
   * // ToArray(",") on "hello,world" returns ["hello", "world"]
   * // ToArray("-") on "a-b-c" returns ["a", "b", "c"]
   */
  ToArray: stringTransformers.register('String.ToArray', {
    inputSchema: stringSchema,
    argumentsSchema: z.tuple([z.string().optional()]),
    factory: () => (value: string, separator?: string) => {
      if (separator === undefined) {
        return value.split('')
      }

      return value.split(separator)
    },
  }),

  // TODO: This probably needs to support supplying/choosing a format.
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
  ToDate: stringTransformers.register('String.ToDate', {
    inputSchema: stringSchema,
    factory: () => (value: string) => parseDateString(value, 'Transformer.String.ToDate'),
  }),

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
  FormatDate: stringTransformers.register('String.FormatDate', {
    inputSchema: stringSchema,
    argumentsSchema: z.tuple([formatDateOptionsSchema.optional()]),
    factory: () => (value: string, options?: StringDateFormatOptions) => {
      const {
        locale = DEFAULT_FORMAT_DATE_LOCALE,
        timeZone = DEFAULT_FORMAT_DATE_TIME_ZONE,
        ...dateTimeFormatOptions
      } = options ?? DEFAULT_FORMAT_DATE_OPTIONS

      const date = parseDateString(value, 'Transformer.String.FormatDate')

      return new Intl.DateTimeFormat(locale, { ...dateTimeFormatOptions, timeZone }).format(date)
    },
  }),

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
  ToISODate: stringTransformers.register('String.ToISODate', {
    inputSchema: stringSchema,
    factory: () => (value: string) => {
      const UK_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
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
  }),

  /**
   * Converts an epoch millisecond date string to a Date (local time).
   * Throws on invalid input so the pipeline errors and the original value is preserved.
   *
   * @example
   * // ToTimestampDate() on "1771429146000" returns 2026-02-18T15:39:06 local
   * // ToTimestampDate() on "" throws Error
   */
  ToTimestampDate: stringTransformers.register('String.ToTimestampDate', {
    inputSchema: stringSchema,
    factory: () => (value: string) => {
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
  }),

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
  EscapeHtml: stringTransformers.register('String.EscapeHtml', {
    inputSchema: stringSchema,
    factory: () => (value: string) => escapeHtmlEntities(value),
  }),
}

export { stringTransformers as stringTransformersRegistry }
