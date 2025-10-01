import { assertString } from '@form-engine/registry/utils/asserts'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'

/**
 * Helper function to parse and validate ISO-8601 date format (YYYY-MM-DD)
 * @param value - The string to parse
 * @returns Object with year, month, day if valid, null if invalid
 */
function parseISODate(value: string): { year: number; month: number; day: number } | null {
  if (typeof value !== 'string') {
    return null
  }

  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) {
    return null
  }

  const year = parseInt(dateMatch[1], 10)
  const month = parseInt(dateMatch[2], 10)
  const day = parseInt(dateMatch[3], 10)

  // Basic range validation
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  return { year, month, day }
}

export const { conditions: DateConditions, registry: DateConditionsRegistry } = defineConditions({
  /**
   * Checks if a value is a valid ISO-8601 date string (YYYY-MM-DD)
   * @param value - The ISO date string to validate
   * @returns true if the value is a valid date
   */
  IsValid: value => {
    assertString(value, 'Condition.Date.IsValid')

    const parsed = parseISODate(value)
    if (!parsed) {
      return false
    }

    // Create a Date object and check if it's valid and matches the parsed components
    const date = new Date(parsed.year, parsed.month - 1, parsed.day)
    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === parsed.year &&
      date.getMonth() === parsed.month - 1 &&
      date.getDate() === parsed.day
    )
  },

  /**
   * Validates if an ISO date string has a valid year component (1000-9999)
   * @param value - The ISO date string to validate
   * @returns true if the year is valid
   */
  IsValidYear: value => {
    assertString(value, 'Condition.Date.IsValidYear')

    const parsed = parseISODate(value)
    if (!parsed) {
      return false
    }

    // I really hope this doesn't live till 9999
    return parsed.year >= 1000 && parsed.year <= 9999
  },

  /**
   * Validates if an ISO date string has a valid month component (1-12)
   * @param value - The ISO date string to validate
   * @returns true if the month is valid
   */
  IsValidMonth: value => {
    assertString(value, 'Condition.Date.IsValidMonth')

    const parsed = parseISODate(value)
    if (!parsed) {
      return false
    }

    return parsed.month >= 1 && parsed.month <= 12
  },

  /**
   * Validates if a date string has a valid day component for its specific month/year
   * Handles leap years and varying month lengths correctly
   * @param value - The ISO date string to validate (YYYY-MM-DD format)
   * @returns true if the day is valid for the specific month and year
   */
  IsValidDay: value => {
    assertString(value, 'Condition.Date.IsValidDay')

    // Parse ISO date format (YYYY-MM-DD)
    const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!dateMatch) {
      return false
    }

    const year = parseInt(dateMatch[1], 10)
    const month = parseInt(dateMatch[2], 10)
    const day = parseInt(dateMatch[3], 10)

    // Validate month first
    if (month < 1 || month > 12) {
      return false
    }

    // Get the actual number of days in this specific month/year
    const daysInMonth = new Date(year, month, 0).getDate()

    // Validate day against actual month length
    return day >= 1 && day <= daysInMonth
  },

  /**
   * Checks if an ISO date string is before another ISO date string
   * @param value - The ISO date string to test
   * @param dateStr - The comparison ISO date string
   * @returns true if value is before the comparison date
   */
  IsBefore: (value, dateStr: string) => {
    assertString(value, 'Condition.Date.IsBefore')

    const valueParsed = parseISODate(value)
    const compareParsed = parseISODate(dateStr)

    if (!valueParsed) {
      throw new Error(`Condition.Date.IsBefore: Invalid date string "${value}"`)
    }
    if (!compareParsed) {
      throw new Error(`Condition.Date.IsBefore: Invalid comparison date string "${dateStr}"`)
    }

    const valueDate = new Date(valueParsed.year, valueParsed.month - 1, valueParsed.day)
    const compareDate = new Date(compareParsed.year, compareParsed.month - 1, compareParsed.day)

    return valueDate < compareDate
  },

  /**
   * Checks if an ISO date string is after another ISO date string
   * @param value - The ISO date string to test
   * @param dateStr - The comparison ISO date string
   * @returns true if value is after the comparison date
   */
  IsAfter: (value, dateStr: string) => {
    assertString(value, 'Condition.Date.IsAfter')

    const valueParsed = parseISODate(value)
    if (!valueParsed) {
      throw new Error(`Condition.Date.IsAfter: Invalid date string "${value}"`)
    }

    const compareParsed = parseISODate(dateStr)
    if (!compareParsed) {
      throw new Error(`Condition.Date.IsAfter: Invalid comparison date string "${dateStr}"`)
    }

    const valueDate = new Date(valueParsed.year, valueParsed.month - 1, valueParsed.day)
    const compareDate = new Date(compareParsed.year, compareParsed.month - 1, compareParsed.day)

    return valueDate > compareDate
  },

  /**
   * Checks if an ISO date string is in the future (after today)
   * @param value - The ISO date string to test
   * @returns true if value is after today
   */
  IsFutureDate: value => {
    assertString(value, 'Condition.Date.IsFutureDate')

    const parsed = parseISODate(value)
    if (!parsed) {
      throw new Error(`Condition.Date.IsFutureDate: Invalid date string "${value}"`)
    }

    const valueDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
    const today = new Date()
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

    return valueDate > todayUTC
  },
})
