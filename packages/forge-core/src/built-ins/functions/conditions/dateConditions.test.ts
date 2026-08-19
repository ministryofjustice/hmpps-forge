import { DateConditions, dateConditionsRegistry } from './dateConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('DateConditions', () => {
  const harness = new FunctionRegistryTestHarness(dateConditionsRegistry)

  describe('IsValid', () => {
    test('should return true for valid ISO date strings', () => {
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2025-09-05')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2024-12-31')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2000-02-29')).toBe(true) // Leap year
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2023-02-28')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValid()).withInput('1999-01-01')).toBe(true)
    })

    test('should return false for invalid ISO date strings', () => {
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2025-02-30')).toBe(false) // February doesn't have 30 days
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2023-02-29')).toBe(false) // Not a leap year
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2025-04-31')).toBe(false) // April only has 30 days
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2025-13-01')).toBe(false) // Invalid month
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2025-00-01')).toBe(false) // Invalid month
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2025-01-00')).toBe(false) // Invalid day
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2025-01-32')).toBe(false) // Invalid day
    })

    test('should return false for malformed date strings', () => {
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2024-1-1')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValid()).withInput('24-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValid()).withInput('2024/01/01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValid()).withInput('invalid')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsValid()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsValid',
        arguments: [],
      })
    })
  })

  describe('IsValidYear', () => {
    test('should return true for valid years in ISO date strings', () => {
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('2024-01-01')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('1000-12-31')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('9999-01-01')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('2000-02-29')).toBe(true)
    })

    test('should return false for invalid years', () => {
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('0999-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('999-01-01')).toBe(false)
    })

    test('should return false for malformed date strings', () => {
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('24-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('2024-1-1')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidYear()).withInput('invalid')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsValidYear()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsValidYear',
        arguments: [],
      })
    })
  })

  describe('IsValidMonth', () => {
    test('should return true for valid months in ISO date strings', () => {
      expect(harness.evaluate(DateConditions.IsValidMonth()).withInput('1990-01-01')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValidMonth()).withInput('1990-02-29')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValidMonth()).withInput('1990-09-05')).toBe(true)
    })

    test('should return false for invalid months', () => {
      expect(harness.evaluate(DateConditions.IsValidMonth()).withInput('2021-00-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidMonth()).withInput('2021-13-01')).toBe(false)
    })

    test('should return false for malformed date strings', () => {
      expect(harness.evaluate(DateConditions.IsValidMonth()).withInput('2024-1-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidMonth()).withInput('invalid')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsValidMonth()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsValidMonth',
        arguments: [],
      })
    })
  })

  describe('IsValidDay', () => {
    test('should return true for valid days in regular months', () => {
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-01-15')).toBe(true) // January (31 days)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-04-30')).toBe(true) // April (30 days)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-06-15')).toBe(true) // June (30 days)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-12-31')).toBe(true) // December (31 days)
    })

    test('should return false for invalid days in specific months', () => {
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-02-30')).toBe(false) // February doesn't have 30 days
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2023-02-29')).toBe(false) // 2023 is not a leap year
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-04-31')).toBe(false) // April only has 30 days
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2025-06-31')).toBe(false) // June only has 30 days
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2025-01-32')).toBe(false) // January doesn't have 32 days
    })

    test('should return false for generally invalid days', () => {
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-01-00')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-13-15')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-00-15')).toBe(false)
    })

    test('should return false for malformed date strings', () => {
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024-1-1')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('24-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2024/01/01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('invalid')).toBe(false)
    })

    test('should handle leap year edge cases correctly', () => {
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2000-02-29')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2004-02-29')).toBe(true)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('1900-02-29')).toBe(false)
      expect(harness.evaluate(DateConditions.IsValidDay()).withInput('2001-02-29')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsValidDay()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsValidDay',
        arguments: [],
      })
    })
  })

  describe('IsBefore', () => {
    test('should return true when date is before comparison date', () => {
      expect(harness.evaluate(DateConditions.IsBefore('2024-01-02')).withInput('2024-01-01')).toBe(true)
      expect(harness.evaluate(DateConditions.IsBefore('2024-01-01')).withInput('2023-12-31')).toBe(true)
      expect(harness.evaluate(DateConditions.IsBefore('2024-02-01')).withInput('2024-01-15')).toBe(true)
      expect(harness.evaluate(DateConditions.IsBefore('2024-01-01')).withInput('2020-01-01')).toBe(true)
    })

    test('should return false when date is equal to comparison date', () => {
      expect(harness.evaluate(DateConditions.IsBefore('2024-01-01')).withInput('2024-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsBefore('2024-12-31')).withInput('2024-12-31')).toBe(false)
    })

    test('should return false when date is after comparison date', () => {
      expect(harness.evaluate(DateConditions.IsBefore('2024-01-01')).withInput('2024-01-02')).toBe(false)
      expect(harness.evaluate(DateConditions.IsBefore('2023-12-31')).withInput('2024-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsBefore('2024-01-15')).withInput('2024-02-01')).toBe(false)
    })

    test('should throw error when value is invalid date string', () => {
      expect(() => harness.evaluate(DateConditions.IsBefore('2024-01-01')).withInput('invalid-date')).toThrow(
        'Condition.Date.IsBefore: Invalid date string "invalid-date"',
      )
      expect(() => harness.evaluate(DateConditions.IsBefore('2024-01-01')).withInput('2024-13-01')).toThrow(
        'Condition.Date.IsBefore: Invalid date string "2024-13-01"',
      )
    })

    test('should throw error when comparison date string is invalid', () => {
      expect(() => harness.evaluate(DateConditions.IsBefore('invalid-date')).withInput('2024-01-01')).toThrow(
        'Condition.Date.IsBefore: Invalid comparison date string "invalid-date"',
      )
      expect(() => harness.evaluate(DateConditions.IsBefore('2024-13-01')).withInput('2024-01-01')).toThrow(
        'Condition.Date.IsBefore: Invalid comparison date string "2024-13-01"',
      )
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsBefore('2024-12-31')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsBefore',
        arguments: ['2024-12-31'],
      })
    })
  })

  describe('IsAfter', () => {
    test('should return true when date is after comparison date', () => {
      expect(harness.evaluate(DateConditions.IsAfter('2024-01-01')).withInput('2024-01-02')).toBe(true)
      expect(harness.evaluate(DateConditions.IsAfter('2023-12-31')).withInput('2024-01-01')).toBe(true)
      expect(harness.evaluate(DateConditions.IsAfter('2024-01-15')).withInput('2024-02-01')).toBe(true)
      expect(harness.evaluate(DateConditions.IsAfter('2020-01-01')).withInput('2024-01-01')).toBe(true)
    })

    test('should return false when date is equal to comparison date', () => {
      expect(harness.evaluate(DateConditions.IsAfter('2024-01-01')).withInput('2024-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsAfter('2024-12-31')).withInput('2024-12-31')).toBe(false)
    })

    test('should return false when date is before comparison date', () => {
      expect(harness.evaluate(DateConditions.IsAfter('2024-01-02')).withInput('2024-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsAfter('2024-01-01')).withInput('2023-12-31')).toBe(false)
      expect(harness.evaluate(DateConditions.IsAfter('2024-02-01')).withInput('2024-01-15')).toBe(false)
    })

    test('should throw error when value is invalid date string', () => {
      expect(() => harness.evaluate(DateConditions.IsAfter('2024-01-01')).withInput('invalid-date')).toThrow(
        'Condition.Date.IsAfter: Invalid date string "invalid-date"',
      )
    })

    test('should throw error when comparison date string is invalid', () => {
      expect(() => harness.evaluate(DateConditions.IsAfter('invalid-date')).withInput('2024-01-01')).toThrow(
        'Condition.Date.IsAfter: Invalid comparison date string "invalid-date"',
      )
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsAfter('2024-01-01')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsAfter',
        arguments: ['2024-01-01'],
      })
    })
  })

  describe('IsFutureDate', () => {
    test('should return true for future dates', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowISO = tomorrow.toISOString().split('T')[0]

      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekISO = nextWeek.toISOString().split('T')[0]

      expect(harness.evaluate(DateConditions.IsFutureDate()).withInput(tomorrowISO)).toBe(true)
      expect(harness.evaluate(DateConditions.IsFutureDate()).withInput(nextWeekISO)).toBe(true)
      expect(harness.evaluate(DateConditions.IsFutureDate()).withInput('2999-12-31')).toBe(true)
    })

    test('should return false for past dates', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISO = yesterday.toISOString().split('T')[0]

      expect(harness.evaluate(DateConditions.IsFutureDate()).withInput(yesterdayISO)).toBe(false)
      expect(harness.evaluate(DateConditions.IsFutureDate()).withInput('2020-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsFutureDate()).withInput('1999-12-31')).toBe(false)
    })

    test('should return false for today', () => {
      const today = new Date().toISOString().split('T')[0]
      expect(harness.evaluate(DateConditions.IsFutureDate()).withInput(today)).toBe(false)
    })

    test('should throw error when value is invalid date string', () => {
      expect(() => harness.evaluate(DateConditions.IsFutureDate()).withInput('invalid-date')).toThrow(
        'Condition.Date.IsFutureDate: Invalid date string "invalid-date"',
      )
      expect(() => harness.evaluate(DateConditions.IsFutureDate()).withInput('2024-13-01')).toThrow(
        'Condition.Date.IsFutureDate: Invalid date string "2024-13-01"',
      )
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsFutureDate()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsFutureDate',
        arguments: [],
      })
    })
  })

  describe('IsToday', () => {
    test('should return true for today', () => {
      const today = new Date().toISOString().split('T')[0]
      expect(harness.evaluate(DateConditions.IsToday()).withInput(today)).toBe(true)
    })

    test('should return false for past dates', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISO = yesterday.toISOString().split('T')[0]

      expect(harness.evaluate(DateConditions.IsToday()).withInput(yesterdayISO)).toBe(false)
      expect(harness.evaluate(DateConditions.IsToday()).withInput('2020-01-01')).toBe(false)
      expect(harness.evaluate(DateConditions.IsToday()).withInput('1999-12-31')).toBe(false)
    })

    test('should return false for future dates', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowISO = tomorrow.toISOString().split('T')[0]

      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekISO = nextWeek.toISOString().split('T')[0]

      expect(harness.evaluate(DateConditions.IsToday()).withInput(tomorrowISO)).toBe(false)
      expect(harness.evaluate(DateConditions.IsToday()).withInput(nextWeekISO)).toBe(false)
      expect(harness.evaluate(DateConditions.IsToday()).withInput('2999-12-31')).toBe(false)
    })

    test('should throw error when value is invalid date string', () => {
      expect(() => harness.evaluate(DateConditions.IsToday()).withInput('invalid-date')).toThrow(
        'Condition.Date.IsToday: Invalid date string "invalid-date"',
      )
      expect(() => harness.evaluate(DateConditions.IsToday()).withInput('2024-13-01')).toThrow(
        'Condition.Date.IsToday: Invalid date string "2024-13-01"',
      )
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsToday()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Date.IsToday',
        arguments: [],
      })
    })
  })
})
