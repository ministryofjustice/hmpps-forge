import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'
import { ValueExpr } from '@form-engine/form/types/expressions.type'
import { assertDate, assertNumber, assertString } from '@form-engine/registry/utils/asserts'

/**
 * Format tokens for date formatting
 */
const formatDate = (date: Date, format: string): string => {
  const tokens: Record<string, () => string> = {
    YYYY: () => String(date.getFullYear()),
    YY: () => String(date.getFullYear()).slice(-2),
    MM: () => String(date.getMonth() + 1).padStart(2, '0'),
    M: () => String(date.getMonth() + 1),
    DD: () => String(date.getDate()).padStart(2, '0'),
    D: () => String(date.getDate()),
    HH: () => String(date.getHours()).padStart(2, '0'),
    H: () => String(date.getHours()),
    mm: () => String(date.getMinutes()).padStart(2, '0'),
    m: () => String(date.getMinutes()),
    ss: () => String(date.getSeconds()).padStart(2, '0'),
    s: () => String(date.getSeconds()),
  }

  // Sort by length descending to match longer tokens first (YYYY before YY)
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
 * // Add days to a date
 * Generator.Date.Today().pipe(Transformer.Date.AddDays(7))
 */
export const { transformers: DateTransformers, registry: DateTransformersRegistry } = defineTransformers({
  /**
   * Formats a Date object into a string using the specified format
   *
   * Supported tokens:
   * - YYYY: 4-digit year (2024)
   * - YY: 2-digit year (24)
   * - MM: 2-digit month (01-12)
   * - M: Month (1-12)
   * - DD: 2-digit day (01-31)
   * - D: Day (1-31)
   * - HH: 2-digit hours (00-23)
   * - H: Hours (0-23)
   * - mm: 2-digit minutes (00-59)
   * - m: Minutes (0-59)
   * - ss: 2-digit seconds (00-59)
   * - s: Seconds (0-59)
   *
   * @example
   * // Format("DD/MM/YYYY") -> "15/03/2024"
   * // Format("YYYY-MM-DD") -> "2024-03-15"
   * // Format("D M YYYY") -> "15 3 2024"
   * // Format("HH:mm:ss") -> "14:30:45"
   */
  Format: (value: any, format: string | ValueExpr) => {
    assertDate(value, 'Transformer.Date.Format')
    assertString(format, 'Transformer.Date.Format (format)')

    return formatDate(value, format)
  },

  /**
   * Adds a number of days to a Date
   * @example
   * // AddDays(7) adds one week
   * // AddDays(-1) subtracts one day
   */
  AddDays: (value: any, days: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.AddDays')
    assertNumber(days, 'Transformer.Date.AddDays (days)')

    const result = new Date(value)
    result.setDate(result.getDate() + days)
    return result
  },

  /**
   * Subtracts a number of days from a Date
   * @example
   * // SubtractDays(7) subtracts one week
   */
  SubtractDays: (value: any, days: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.SubtractDays')
    assertNumber(days, 'Transformer.Date.SubtractDays (days)')

    const result = new Date(value)
    result.setDate(result.getDate() - days)
    return result
  },

  /**
   * Adds a number of months to a Date
   * @example
   * // AddMonths(1) adds one month
   * // AddMonths(-6) subtracts 6 months
   */
  AddMonths: (value: any, months: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.AddMonths')
    assertNumber(months, 'Transformer.Date.AddMonths (months)')

    const result = new Date(value)
    result.setMonth(result.getMonth() + months)
    return result
  },

  /**
   * Adds a number of years to a Date
   * @example
   * // AddYears(1) adds one year
   * // AddYears(-18) subtracts 18 years
   */
  AddYears: (value: any, years: number | ValueExpr) => {
    assertDate(value, 'Transformer.Date.AddYears')
    assertNumber(years, 'Transformer.Date.AddYears (years)')

    const result = new Date(value)
    result.setFullYear(result.getFullYear() + years)
    return result
  },

  /**
   * Returns the start of the day (midnight) for a Date
   * @example
   * // StartOfDay() -> 2024-03-15T00:00:00.000
   */
  StartOfDay: (value: any) => {
    assertDate(value, 'Transformer.Date.StartOfDay')

    const result = new Date(value)
    result.setHours(0, 0, 0, 0)
    return result
  },

  /**
   * Returns the end of the day (23:59:59.999) for a Date
   * @example
   * // EndOfDay() -> 2024-03-15T23:59:59.999
   */
  EndOfDay: (value: any) => {
    assertDate(value, 'Transformer.Date.EndOfDay')

    const result = new Date(value)
    result.setHours(23, 59, 59, 999)
    return result
  },

  /**
   * Converts a Date to ISO-8601 string format
   * @example
   * // ToISOString() -> "2024-03-15T14:30:45.123Z"
   */
  ToISOString: (value: any) => {
    assertDate(value, 'Transformer.Date.ToISOString')
    return value.toISOString()
  },

  /**
   * Converts a Date to a locale-specific string
   * @example
   * // ToLocaleString() -> "15/03/2024, 14:30:45" (UK locale)
   * // ToLocaleString('en-US') -> "3/15/2024, 2:30:45 PM"
   */
  ToLocaleString: (value: any, locale?: string) => {
    assertDate(value, 'Transformer.Date.ToLocaleString')
    return locale ? value.toLocaleString(locale) : value.toLocaleString()
  },
})
