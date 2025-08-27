import { buildTransformerFunction } from '../helpers/createRegisterableFunction'
import { assertObject } from '../conditions/asserts'
import { getByPath } from '../../utils'

interface DateParts {
  year?: string
  month?: string
  day?: string
}

export default {
  /**
   * Converts an object with date parts to an ISO 8601 date string
   * Supports full dates (YYYY-MM-DD), partial dates (YYYY-MM, MM-DD), or single components
   *
   * @param paths - Object mapping date components to property paths
   * @example
   * // Full date: {day: "15", month: "3", year: "2024"} → "2024-03-15"
   * ToISO({year: 'year', month: 'month', day: 'day'})
   *
   * // Partial date: {month: "3", year: "2024"} → "2024-03"
   * ToISO({year: 'year', month: 'month'})
   *
   * // Nested paths: {date: {y: "2024", m: "3", d: "15"}} → "2024-03-15"
   * ToISO({year: 'date.y', month: 'date.m', day: 'date.d'})
   */
  ToISO: buildTransformerFunction('objectToISO', (value: any, paths: DateParts) => {
    assertObject(value, 'Transformer.Object.ToISO')

    if (!paths || typeof paths !== 'object') {
      throw new Error('Transformer.Object.ToISO requires a paths configuration object')
    }

    // Extract values using paths
    const year = paths.year ? getByPath(value, paths.year) : undefined
    const month = paths.month ? getByPath(value, paths.month) : undefined
    const day = paths.day ? getByPath(value, paths.day) : undefined

    // Validate extracted values are numeric strings if present
    if (year && !/^\d{1,4}$/.test(year)) {
      throw new Error(`Transformer.Object.ToISO: Invalid year value "${year}"`)
    }

    if (month && !/^\d{1,2}$/.test(month)) {
      throw new Error(`Transformer.Object.ToISO: Invalid month value "${month}"`)
    }

    if (day && !/^\d{1,2}$/.test(day)) {
      throw new Error(`Transformer.Object.ToISO: Invalid day value "${day}"`)
    }

    // Validate month and day ranges
    if (month) {
      const monthNum = parseInt(month, 10)
      if (monthNum < 1 || monthNum > 12) {
        throw new Error(`Transformer.Object.ToISO: Month must be between 1 and 12, got "${month}"`)
      }
    }

    if (day) {
      const dayNum = parseInt(day, 10)
      if (dayNum < 1 || dayNum > 31) {
        throw new Error(`Transformer.Object.ToISO: Day must be between 1 and 31, got "${day}"`)
      }
    }

    // Build ISO string based on what's provided
    if (year && month && day) {
      // Full date: YYYY-MM-DD
      const paddedMonth = month.padStart(2, '0')
      const paddedDay = day.padStart(2, '0')
      return `${year}-${paddedMonth}-${paddedDay}`
    }

    if (year && month) {
      // Year-Month: YYYY-MM
      const paddedMonth = month.padStart(2, '0')
      return `${year}-${paddedMonth}`
    }

    if (month && day) {
      // Month-Day (recurring date): --MM-DD
      const paddedMonth = month.padStart(2, '0')
      const paddedDay = day.padStart(2, '0')
      return `--${paddedMonth}-${paddedDay}`
    }

    if (year) {
      // Year only: YYYY
      return year
    }

    // No valid date components found
    throw new Error('Transformer.Object.ToISO: No valid date components found in object')
  }),
}
