import { assertObject } from '../../shared/utils/asserts'
import TransformerRegistry from '../registries/TransformerRegistry'
import { getByPath } from '../../shared/utils/utils'

export interface DateParts {
  year?: string
  month?: string
  day?: string
}

const objectTransformers = new TransformerRegistry()

export const ObjectTransformers = {
  /**
   * Converts an object with date parts to an ISO 8601 date string
   * Supports full dates (YYYY-MM-DD), partial dates (YYYY-MM, MM-DD), or single components
   *
   * @param paths - Object mapping date components to property paths
   * @example
   * // Full date: {day: "15", month: "3", year: "2024"} becomes "2024-03-15"
   * ToISO({year: 'year', month: 'month', day: 'day'})
   *
   * @example
   * // Partial date: {month: "3", year: "2024"} becomes "2024-03"
   * ToISO({year: 'year', month: 'month'})
   *
   * @example
   * // Nested paths: {date: {y: "2024", m: "3", d: "15"}} becomes "2024-03-15"
   * ToISO({year: 'date.y', month: 'date.m', day: 'date.d'})
   */
  ToISO: objectTransformers.register('Object.ToISO', () => (value: any, paths: DateParts) => {
    assertObject(value, 'Transformer.Object.ToISO')

    if (!paths || typeof paths !== 'object') {
      throw new Error('Transformer.Object.ToISO requires a paths configuration object')
    }

    const year = paths.year ? getByPath<string>(value, paths.year) : undefined
    const month = paths.month ? getByPath<string>(value, paths.month) : undefined
    const day = paths.day ? getByPath<string>(value, paths.day) : undefined

    // If all three paths are specified (full date expected), require all three values
    // so field-specific validation can run when any field is empty.
    if (paths.year && paths.month && paths.day) {
      if (!year || !month || !day) {
        throw new TypeError('Transformer.Object.ToISO: Full date requested but not all fields provided')
      }
    }

    if (year && !/^\d{1,4}$/.test(year)) {
      throw new TypeError(`Transformer.Object.ToISO: Invalid year value "${year}"`)
    }

    if (month && !/^\d{1,2}$/.test(month)) {
      throw new TypeError(`Transformer.Object.ToISO: Invalid month value "${month}"`)
    }

    if (day && !/^\d{1,2}$/.test(day)) {
      throw new TypeError(`Transformer.Object.ToISO: Invalid day value "${day}"`)
    }

    if (month) {
      const monthNum = parseInt(month, 10)
      if (monthNum < 1 || monthNum > 12) {
        throw new TypeError(`Transformer.Object.ToISO: Month must be between 1 and 12, got "${month}"`)
      }
    }

    if (day) {
      const dayNum = parseInt(day, 10)
      if (dayNum < 1 || dayNum > 31) {
        throw new TypeError(`Transformer.Object.ToISO: Day must be between 1 and 31, got "${day}"`)
      }
    }

    if (year && month && day) {
      const paddedYear = year.padStart(4, '0')
      const paddedMonth = month.padStart(2, '0')
      const paddedDay = day.padStart(2, '0')
      return `${paddedYear}-${paddedMonth}-${paddedDay}`
    }

    if (year && month) {
      const paddedYear = year.padStart(4, '0')
      const paddedMonth = month.padStart(2, '0')
      return `${paddedYear}-${paddedMonth}`
    }

    if (month && day) {
      const paddedMonth = month.padStart(2, '0')
      const paddedDay = day.padStart(2, '0')
      return `--${paddedMonth}-${paddedDay}`
    }

    if (year) {
      return year.padStart(4, '0')
    }

    throw new TypeError('Transformer.Object.ToISO: No valid date components found in object')
  }),

  /**
   * Converts an ISO 8601 date string back to an object with date parts.
   * The inverse of ToISO. Objects are passed through unchanged.
   *
   * @param paths - Object mapping date components to output property names
   * @example
   * // Full date: "2024-03-15" becomes {year: "2024", month: "03", day: "15"}
   * FromISO({year: 'year', month: 'month', day: 'day'})
   *
   * @example
   * // Year-month: "2024-03" becomes {year: "2024", month: "03"}
   * FromISO({year: 'year', month: 'month'})
   */
  FromISO: objectTransformers.register('Object.FromISO', () => (value: any, paths: DateParts) => {
    if (typeof value === 'object' && value !== null) {
      return value
    }

    if (!paths || typeof paths !== 'object') {
      throw new Error('Transformer.Object.FromISO requires a paths configuration object')
    }

    if (typeof value !== 'string' || !value) {
      return {}
    }

    const result: Record<string, string> = {}
    const hasYear = Boolean(paths.year)
    const hasMonth = Boolean(paths.month)
    const hasDay = Boolean(paths.day)

    if (hasYear && hasMonth && hasDay) {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

      if (match) {
        result[paths.year!] = match[1]
        result[paths.month!] = match[2]
        result[paths.day!] = match[3]

        return result
      }
    }

    if (hasYear && hasMonth && !hasDay) {
      const match = value.match(/^(\d{4})-(\d{2})$/)

      if (match) {
        result[paths.year!] = match[1]
        result[paths.month!] = match[2]

        return result
      }
    }

    if (hasMonth && hasDay && !hasYear) {
      const match = value.match(/^(?:--)?(\d{2})-(\d{2})$/)

      if (match) {
        result[paths.month!] = match[1]
        result[paths.day!] = match[2]

        return result
      }
    }

    if (hasYear && !hasMonth && !hasDay) {
      const match = value.match(/^(\d{4})$/)

      if (match) {
        result[paths.year!] = match[1]

        return result
      }
    }

    return {}
  }),
}

export { objectTransformers as objectTransformersRegistry }
