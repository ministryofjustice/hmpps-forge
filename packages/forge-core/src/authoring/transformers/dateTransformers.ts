import { createFunctionsRegistry } from '../utils/createFunctionsRegistry'
import { defineTransformerFunctions } from '../utils/defineTransformerFunctions'
import { TransformerFunctionExpr, ValueExpr } from '../types/expressions.type'
import { assertDate, assertNumber, assertString } from '../../shared/utils/asserts'

const formatDate = (date: Date, format: string): string => {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const getOrdinal = (n: number): string => {
    const remainder10 = n % 10
    const remainder100 = n % 100

    if (remainder100 >= 11 && remainder100 <= 13) return `${n}th`
    if (remainder10 === 1) return `${n}st`
    if (remainder10 === 2) return `${n}nd`
    if (remainder10 === 3) return `${n}rd`
    return `${n}th`
  }

  const tokens: Record<string, () => string> = {
    YYYY: () => String(date.getFullYear()),
    YY: () => String(date.getFullYear()).slice(-2),
    MMMM: () => monthNames[date.getMonth()],
    MM: () => String(date.getMonth() + 1).padStart(2, '0'),
    M: () => String(date.getMonth() + 1),
    DD: () => String(date.getDate()).padStart(2, '0'),
    Do: () => getOrdinal(date.getDate()),
    D: () => String(date.getDate()),
    HH: () => String(date.getHours()).padStart(2, '0'),
    H: () => String(date.getHours()),
    mm: () => String(date.getMinutes()).padStart(2, '0'),
    m: () => String(date.getMinutes()),
    ss: () => String(date.getSeconds()).padStart(2, '0'),
    s: () => String(date.getSeconds()),
  }

  // Sort by length descending so longer tokens match first (YYYY before YY)
  const tokenPattern = Object.keys(tokens)
    .sort((a, b) => b.length - a.length)
    .join('|')

  return format.replace(new RegExp(tokenPattern, 'g'), match => tokens[match]())
}

/**
 * Date transformation functions for data processing
 *
 * @example
 * // Format a date
 * Generator.Date.Now().pipe(Transformer.Date.Format('DD/MM/YYYY'))
 *
 * @example
 * // Add days to a date
 * Generator.Date.Today().pipe(Transformer.Date.AddDays(7))
 */
export interface DateTransformerGroup {
  /**
   * Formats a Date object into a string using the specified format
   *
   * Supported tokens:
   * - YYYY: 4-digit year (2024)
   * - YY: 2-digit year (24)
   * - MMMM: Full month name (January, February, March, etc.)
   * - MM: 2-digit month (01-12)
   * - M: Month (1-12)
   * - DD: 2-digit day (01-31)
   * - Do: Day of month (1st, 2nd, 3rd, etc.)
   * - D: Day (1-31)
   * - HH: 2-digit hours (00-23)
   * - H: Hours (0-23)
   * - mm: 2-digit minutes (00-59)
   * - m: Minutes (0-59)
   * - ss: 2-digit seconds (00-59)
   * - s: Seconds (0-59)
   *
   * @param format - Format string using the supported tokens
   * @example
   * // Format("DD/MM/YYYY") returns "15/03/2024"
   * // Format("YYYY-MM-DD") returns "2024-03-15"
   * // Format("D M YYYY") returns "15 3 2024"
   * // Format("HH:mm:ss") returns "14:30:45"
   */
  Format: (format: string | ValueExpr) => TransformerFunctionExpr

  /**
   * Adds a number of days to a Date
   * @param days - Number of days to add (negative values subtract)
   * @example
   * // AddDays(7) adds one week
   * // AddDays(-1) subtracts one day
   */
  AddDays: (days: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Subtracts a number of days from a Date
   * @param days - Number of days to subtract
   * @example
   * // SubtractDays(7) subtracts one week
   */
  SubtractDays: (days: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Adds a number of months to a Date
   * @param months - Number of months to add (negative values subtract)
   * @example
   * // AddMonths(1) adds one month
   * // AddMonths(-6) subtracts 6 months
   */
  AddMonths: (months: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Adds a number of years to a Date
   * @param years - Number of years to add (negative values subtract)
   * @example
   * // AddYears(1) adds one year
   * // AddYears(-18) subtracts 18 years
   */
  AddYears: (years: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Returns the start of the day (midnight) for a Date
   * @example
   * // StartOfDay() returns 2024-03-15T00:00:00.000
   */
  StartOfDay: () => TransformerFunctionExpr

  /**
   * Returns the end of the day (23:59:59.999) for a Date
   * @example
   * // EndOfDay() returns 2024-03-15T23:59:59.999
   */
  EndOfDay: () => TransformerFunctionExpr

  /**
   * Converts a Date to ISO-8601 string format
   * @example
   * // ToISOString() returns "2024-03-15T14:30:45.123Z"
   */
  ToISOString: () => TransformerFunctionExpr

  /**
   * Converts a Date to a locale-specific string
   * @param locale - Optional locale identifier (e.g. 'en-GB', 'en-US')
   * @example
   * // ToLocaleString() returns "15/03/2024, 14:30:45" (UK locale)
   * // ToLocaleString('en-US') returns "3/15/2024, 2:30:45 PM"
   */
  ToLocaleString: (locale?: string | ValueExpr) => TransformerFunctionExpr

  /**
   * Converts a Date to UK long date format (e.g. "18 March 2026")
   * @example
   * // ToUKLongDate() returns "18 March 2026"
   */
  ToUKLongDate: () => TransformerFunctionExpr
}

const { transformers: DateTransformers, implementations } = defineTransformerFunctions<DateTransformerGroup>({
  Format: () => (value: any, format: string | ValueExpr) => {
    assertDate(value, 'Transformer.Date.Format')
    assertString(format, 'Transformer.Date.Format (format)')

    return formatDate(value, format)
  },

  AddDays: () => (value: any, days: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.AddDays')
    assertNumber(days, 'Transformer.Date.AddDays (days)')

    const result = new Date(value)
    result.setDate(result.getDate() + days)
    return result
  },

  SubtractDays: () => (value: any, days: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.SubtractDays')
    assertNumber(days, 'Transformer.Date.SubtractDays (days)')

    const result = new Date(value)
    result.setDate(result.getDate() - days)
    return result
  },

  AddMonths: () => (value: any, months: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.AddMonths')
    assertNumber(months, 'Transformer.Date.AddMonths (months)')

    const result = new Date(value)
    result.setMonth(result.getMonth() + months)
    return result
  },

  AddYears: () => (value: any, years: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.AddYears')
    assertNumber(years, 'Transformer.Date.AddYears (years)')

    const result = new Date(value)
    result.setFullYear(result.getFullYear() + years)
    return result
  },

  StartOfDay: () => (value: any) => {
    assertDate(value, 'Transformer.Date.StartOfDay')

    const result = new Date(value)
    result.setHours(0, 0, 0, 0)
    return result
  },

  EndOfDay: () => (value: any) => {
    assertDate(value, 'Transformer.Date.EndOfDay')

    const result = new Date(value)
    result.setHours(23, 59, 59, 999)
    return result
  },

  ToISOString: () => (value: any) => {
    assertDate(value, 'Transformer.Date.ToISOString')
    return value.toISOString()
  },

  ToLocaleString: () => (value: any, locale?: string | ValueExpr) => {
    assertDate(value, 'Transformer.Date.ToLocaleString')
    if (locale === undefined) {
      return value.toLocaleString()
    }
    assertString(locale, 'Transformer.Date.ToLocaleString (locale)')
    return value.toLocaleString(locale)
  },

  ToUKLongDate: () => (value: any) => {
    assertDate(value, 'Transformer.Date.ToUKLongDate')
    return value.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  },
})

const DateTransformersRegistry = createFunctionsRegistry(implementations)

export { DateTransformers, DateTransformersRegistry }
