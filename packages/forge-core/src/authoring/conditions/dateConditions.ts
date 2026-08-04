import { z } from 'zod'
import ConditionRegistry from '../registries/ConditionRegistry'

function parseISODate(value: unknown): { year: number; month: number; day: number } | null {
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

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  return { year, month, day }
}

const stringSchema = z.string()
const stringArgsSchema = z.tuple([z.string()])

const dateConditions = new ConditionRegistry()

export const DateConditions = {
  /** Checks if a value is a valid ISO-8601 date string (YYYY-MM-DD) */
  IsValid: dateConditions.register(
    'Date.IsValid',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => {
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
  ),

  /** Validates if an ISO date string has a valid year component (1000-9999) */
  IsValidYear: dateConditions.register(
    'Date.IsValidYear',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => {
      const parsed = parseISODate(value)
      if (!parsed) {
        return false
      }

      return parsed.year >= 1000 && parsed.year <= 9999
    },
  ),

  /** Validates if an ISO date string has a valid month component (1-12) */
  IsValidMonth: dateConditions.register(
    'Date.IsValidMonth',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => {
      const parsed = parseISODate(value)
      if (!parsed) {
        return false
      }

      return parsed.month >= 1 && parsed.month <= 12
    },
  ),

  /** Validates if a date string has a valid day component for its specific month/year */
  IsValidDay: dateConditions.register(
    'Date.IsValidDay',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => {
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
  ),

  /** Checks if an ISO date string is before another ISO date string */
  IsBefore: dateConditions.register(
    'Date.IsBefore',
    {
      inputSchema: stringSchema,
      argumentsSchema: stringArgsSchema,
    },
    () => (value: string, dateStr: string) => {
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
  ),

  /** Checks if an ISO date string is after another ISO date string */
  IsAfter: dateConditions.register(
    'Date.IsAfter',
    {
      inputSchema: stringSchema,
      argumentsSchema: stringArgsSchema,
    },
    () => (value: string, dateStr: string) => {
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
  ),

  /** Checks if an ISO date string is in the future (after today) */
  IsFutureDate: dateConditions.register(
    'Date.IsFutureDate',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => {
      const parsed = parseISODate(value)
      if (!parsed) {
        throw new Error(`Condition.Date.IsFutureDate: Invalid date string "${value}"`)
      }

      const valueDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
      const today = new Date()
      const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

      return valueDate > todayUTC
    },
  ),

  /** Checks if an ISO date string is in the past (before today) */
  IsPastDate: dateConditions.register(
    'Date.IsPastDate',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => {
      const parsed = parseISODate(value)
      if (!parsed) {
        throw new Error(`Condition.Date.IsPastDate: Invalid date string "${value}"`)
      }

      const valueDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
      const today = new Date()
      const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

      return valueDate < todayUTC
    },
  ),

  /** Checks if an ISO date string is today */
  IsToday: dateConditions.register(
    'Date.IsToday',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => {
      const parsed = parseISODate(value)
      if (!parsed) {
        throw new Error(`Condition.Date.IsToday: Invalid date string "${value}"`)
      }

      const valueDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
      const today = new Date()
      const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

      return valueDate.getTime() === todayUTC.getTime()
    },
  ),
}

export { dateConditions as dateConditionsRegistry }
