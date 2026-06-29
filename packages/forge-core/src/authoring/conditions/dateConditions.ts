import { assertString, isAbsent } from '../../shared/utils/asserts'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'
import { ConditionFunctionExpr, ResolvableValue } from '../types/expressions.type'

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

export interface DateConditionGroup {
  /**
   * Checks if a value is a valid ISO-8601 date string (YYYY-MM-DD)
   * @returns true if the value is a valid date
   */
  IsValid: () => ConditionFunctionExpr

  /**
   * Validates if an ISO date string has a valid year component (1000-9999)
   * @returns true if the year is valid
   */
  IsValidYear: () => ConditionFunctionExpr

  /**
   * Validates if an ISO date string has a valid month component (1-12)
   * @returns true if the month is valid
   */
  IsValidMonth: () => ConditionFunctionExpr

  /**
   * Validates if a date string has a valid day component for its specific month/year
   * Handles leap years and varying month lengths correctly
   * @returns true if the day is valid for the specific month and year
   */
  IsValidDay: () => ConditionFunctionExpr

  /**
   * Checks if an ISO date string is before another ISO date string
   * @param dateStr - The comparison ISO date string
   * @returns true if value is before the comparison date
   */
  IsBefore: (dateStr: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if an ISO date string is after another ISO date string
   * @param dateStr - The comparison ISO date string
   * @returns true if value is after the comparison date
   */
  IsAfter: (dateStr: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if an ISO date string is in the future (after today)
   * @returns true if value is after today
   */
  IsFutureDate: () => ConditionFunctionExpr

  /**
   * Checks if an ISO date string is in the past (before today)
   * @returns true if value is before today
   */
  IsPastDate: () => ConditionFunctionExpr

  /**
   * Checks if an ISO date string is today
   * @returns true if value is today's date
   */
  IsToday: () => ConditionFunctionExpr
}

export const { conditions: DateConditions, implementations: DateConditionsImplementations } =
  defineConditionFunctions<DateConditionGroup>({
    IsValid: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsValid')

      const parsed = parseISODate(value)
      if (!parsed) {
        return false
      }

      const date = new Date(parsed.year, parsed.month - 1, parsed.day)

      return !Number.isNaN(date.getTime()) &&
        date.getFullYear() === parsed.year &&
        date.getMonth() === parsed.month - 1 &&
        date.getDate() === parsed.day
    },

    IsValidYear: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsValidYear')

      const parsed = parseISODate(value)
      if (!parsed) {
        return false
      }

      return parsed.year >= 1000 && parsed.year <= 9999
    },

    IsValidMonth: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsValidMonth')

      const parsed = parseISODate(value)
      if (!parsed) {
        return false
      }

      return parsed.month >= 1 && parsed.month <= 12
    },

    IsValidDay: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsValidDay')

      const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!dateMatch) {
        return false
      }

      const year = parseInt(dateMatch[1], 10)
      const month = parseInt(dateMatch[2], 10)
      const day = parseInt(dateMatch[3], 10)

      if (month < 1 || month > 12) {
        return false
      }

      const daysInMonth = new Date(year, month, 0).getDate()

      return day >= 1 && day <= daysInMonth
    },

    IsBefore: () => (value: unknown, dateStr: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsBefore')
      assertString(dateStr, 'Condition.Date.IsBefore (dateStr)')

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

    IsAfter: () => (value: unknown, dateStr: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsAfter')
      assertString(dateStr, 'Condition.Date.IsAfter (dateStr)')

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

    IsFutureDate: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

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

    IsPastDate: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsPastDate')

      const parsed = parseISODate(value)
      if (!parsed) {
        throw new Error(`Condition.Date.IsPastDate: Invalid date string "${value}"`)
      }

      const valueDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
      const today = new Date()
      const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

      return valueDate < todayUTC
    },

    IsToday: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Date.IsToday')

      const parsed = parseISODate(value)
      if (!parsed) {
        throw new Error(`Condition.Date.IsToday: Invalid date string "${value}"`)
      }

      const valueDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
      const today = new Date()
      const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

      return valueDate.getTime() === todayUTC.getTime()
    },
  })

export const DateConditionsRegistry = DateConditionsImplementations
