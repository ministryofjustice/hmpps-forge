Object.defineProperty(exports, '__esModule', { value: true })
const dateConditions_1 = require('./dateConditions')
const defineFunction_1 = require('../utils/defineFunction')
const enums_1 = require('../types/enums')

describe('DateConditions', function () {
  const registry = (0, defineFunction_1.createFunctionsRegistry)(dateConditions_1.DateConditionsImplementations)
  describe('IsValid', function () {
    const evaluate = registry.IsValid.evaluate
    test('should return true for valid ISO date strings', function () {
      expect(evaluate('2025-09-05')).toBe(true)
      expect(evaluate('2024-12-31')).toBe(true)
      expect(evaluate('2000-02-29')).toBe(true) // Leap year
      expect(evaluate('2023-02-28')).toBe(true)
      expect(evaluate('1999-01-01')).toBe(true)
    })
    test('should return false for invalid ISO date strings', function () {
      expect(evaluate('2025-02-30')).toBe(false) // February doesn't have 30 days
      expect(evaluate('2023-02-29')).toBe(false) // Not a leap year
      expect(evaluate('2025-04-31')).toBe(false) // April only has 30 days
      expect(evaluate('2025-13-01')).toBe(false) // Invalid month
      expect(evaluate('2025-00-01')).toBe(false) // Invalid month
      expect(evaluate('2025-01-00')).toBe(false) // Invalid day
      expect(evaluate('2025-01-32')).toBe(false) // Invalid day
    })
    test('should return false for malformed date strings', function () {
      expect(evaluate('2024-1-1')).toBe(false)
      expect(evaluate('24-01-01')).toBe(false)
      expect(evaluate('2024/01/01')).toBe(false)
      expect(evaluate('invalid')).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(123)
      }).toThrow('Condition.Date.IsValid expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsValid()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsValid',
        arguments: [],
      })
    })
  })
  describe('IsValidYear', function () {
    const evaluate = registry.IsValidYear.evaluate
    test('should return true for valid years in ISO date strings', function () {
      expect(evaluate('2024-01-01')).toBe(true)
      expect(evaluate('1000-12-31')).toBe(true)
      expect(evaluate('9999-01-01')).toBe(true)
      expect(evaluate('2000-02-29')).toBe(true)
    })
    test('should return false for invalid years', function () {
      expect(evaluate('0999-01-01')).toBe(false)
      expect(evaluate('999-01-01')).toBe(false)
    })
    test('should return false for malformed date strings', function () {
      expect(evaluate('24-01-01')).toBe(false)
      expect(evaluate('2024-1-1')).toBe(false)
      expect(evaluate('invalid')).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(2024)
      }).toThrow('Condition.Date.IsValidYear expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsValidYear()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsValidYear',
        arguments: [],
      })
    })
  })
  describe('IsValidMonth', function () {
    const evaluate = registry.IsValidMonth.evaluate
    test('should return true for valid months in ISO date strings', function () {
      expect(evaluate('1990-01-01')).toBe(true)
      expect(evaluate('1990-02-29')).toBe(true)
      expect(evaluate('1990-09-05')).toBe(true)
    })
    test('should return false for invalid months', function () {
      expect(evaluate('2021-00-01')).toBe(false)
      expect(evaluate('2021-13-01')).toBe(false)
    })
    test('should return false for malformed date strings', function () {
      expect(evaluate('2024-1-01')).toBe(false)
      expect(evaluate('invalid')).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(12)
      }).toThrow('Condition.Date.IsValidMonth expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsValidMonth()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsValidMonth',
        arguments: [],
      })
    })
  })
  describe('IsValidDay', function () {
    const evaluate = registry.IsValidDay.evaluate
    test('should return true for valid days in regular months', function () {
      expect(evaluate('2024-01-15')).toBe(true) // January (31 days)
      expect(evaluate('2024-04-30')).toBe(true) // April (30 days)
      expect(evaluate('2024-06-15')).toBe(true) // June (30 days)
      expect(evaluate('2024-12-31')).toBe(true) // December (31 days)
    })
    test('should return false for invalid days in specific months', function () {
      expect(evaluate('2024-02-30')).toBe(false) // February doesn't have 30 days
      expect(evaluate('2023-02-29')).toBe(false) // 2023 is not a leap year
      expect(evaluate('2024-04-31')).toBe(false) // April only has 30 days
      expect(evaluate('2025-06-31')).toBe(false) // June only has 30 days
      expect(evaluate('2025-01-32')).toBe(false) // January doesn't have 32 days
    })
    test('should return false for generally invalid days', function () {
      expect(evaluate('2024-01-00')).toBe(false)
      expect(evaluate('2024-13-15')).toBe(false)
      expect(evaluate('2024-00-15')).toBe(false)
    })
    test('should return false for malformed date strings', function () {
      expect(evaluate('2024-1-1')).toBe(false)
      expect(evaluate('24-01-01')).toBe(false)
      expect(evaluate('2024/01/01')).toBe(false)
      expect(evaluate('invalid')).toBe(false)
    })
    test('should handle leap year edge cases correctly', function () {
      expect(evaluate('2000-02-29')).toBe(true)
      expect(evaluate('2004-02-29')).toBe(true)
      expect(evaluate('1900-02-29')).toBe(false)
      expect(evaluate('2001-02-29')).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(15)
      }).toThrow('Condition.Date.IsValidDay expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsValidDay()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsValidDay',
        arguments: [],
      })
    })
  })
  describe('IsBefore', function () {
    const evaluate = registry.IsBefore.evaluate
    test('should return true when date is before comparison date', function () {
      expect(evaluate('2024-01-01', '2024-01-02')).toBe(true)
      expect(evaluate('2023-12-31', '2024-01-01')).toBe(true)
      expect(evaluate('2024-01-15', '2024-02-01')).toBe(true)
      expect(evaluate('2020-01-01', '2024-01-01')).toBe(true)
    })
    test('should return false when date is equal to comparison date', function () {
      expect(evaluate('2024-01-01', '2024-01-01')).toBe(false)
      expect(evaluate('2024-12-31', '2024-12-31')).toBe(false)
    })
    test('should return false when date is after comparison date', function () {
      expect(evaluate('2024-01-02', '2024-01-01')).toBe(false)
      expect(evaluate('2024-01-01', '2023-12-31')).toBe(false)
      expect(evaluate('2024-02-01', '2024-01-15')).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(123, '2024-01-01')
      }).toThrow('Condition.Date.IsBefore expects a string but received number')
    })
    test('should throw error when value is invalid date string', function () {
      expect(function () {
        return evaluate('invalid-date', '2024-01-01')
      }).toThrow('Condition.Date.IsBefore: Invalid date string "invalid-date"')
      expect(function () {
        return evaluate('2024-13-01', '2024-01-01')
      }).toThrow('Condition.Date.IsBefore: Invalid date string "2024-13-01"')
    })
    test('should throw error when comparison date string is invalid', function () {
      expect(function () {
        return evaluate('2024-01-01', 'invalid-date')
      }).toThrow('Condition.Date.IsBefore: Invalid comparison date string "invalid-date"')
      expect(function () {
        return evaluate('2024-01-01', '2024-13-01')
      }).toThrow('Condition.Date.IsBefore: Invalid comparison date string "2024-13-01"')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsBefore('2024-12-31')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsBefore',
        arguments: ['2024-12-31'],
      })
    })
  })
  describe('IsAfter', function () {
    const evaluate = registry.IsAfter.evaluate
    test('should return true when date is after comparison date', function () {
      expect(evaluate('2024-01-02', '2024-01-01')).toBe(true)
      expect(evaluate('2024-01-01', '2023-12-31')).toBe(true)
      expect(evaluate('2024-02-01', '2024-01-15')).toBe(true)
      expect(evaluate('2024-01-01', '2020-01-01')).toBe(true)
    })
    test('should return false when date is equal to comparison date', function () {
      expect(evaluate('2024-01-01', '2024-01-01')).toBe(false)
      expect(evaluate('2024-12-31', '2024-12-31')).toBe(false)
    })
    test('should return false when date is before comparison date', function () {
      expect(evaluate('2024-01-01', '2024-01-02')).toBe(false)
      expect(evaluate('2023-12-31', '2024-01-01')).toBe(false)
      expect(evaluate('2024-01-15', '2024-02-01')).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(123, '2024-01-01')
      }).toThrow('Condition.Date.IsAfter expects a string but received number')
    })
    test('should throw error when value is invalid date string', function () {
      expect(function () {
        return evaluate('invalid-date', '2024-01-01')
      }).toThrow('Condition.Date.IsAfter: Invalid date string "invalid-date"')
    })
    test('should throw error when comparison date string is invalid', function () {
      expect(function () {
        return evaluate('2024-01-01', 'invalid-date')
      }).toThrow('Condition.Date.IsAfter: Invalid comparison date string "invalid-date"')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsAfter('2024-01-01')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsAfter',
        arguments: ['2024-01-01'],
      })
    })
  })
  describe('IsFutureDate', function () {
    const evaluate = registry.IsFutureDate.evaluate
    test('should return true for future dates', function () {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowISO = tomorrow.toISOString().split('T')[0]
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekISO = nextWeek.toISOString().split('T')[0]
      expect(evaluate(tomorrowISO)).toBe(true)
      expect(evaluate(nextWeekISO)).toBe(true)
      expect(evaluate('2999-12-31')).toBe(true)
    })
    test('should return false for past dates', function () {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISO = yesterday.toISOString().split('T')[0]
      expect(evaluate(yesterdayISO)).toBe(false)
      expect(evaluate('2020-01-01')).toBe(false)
      expect(evaluate('1999-12-31')).toBe(false)
    })
    test('should return false for today', function () {
      const today = new Date().toISOString().split('T')[0]
      expect(evaluate(today)).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(123)
      }).toThrow('Condition.Date.IsFutureDate expects a string but received number')
    })
    test('should throw error when value is invalid date string', function () {
      expect(function () {
        return evaluate('invalid-date')
      }).toThrow('Condition.Date.IsFutureDate: Invalid date string "invalid-date"')
      expect(function () {
        return evaluate('2024-13-01')
      }).toThrow('Condition.Date.IsFutureDate: Invalid date string "2024-13-01"')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsFutureDate()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsFutureDate',
        arguments: [],
      })
    })
  })
  describe('IsToday', function () {
    const evaluate = registry.IsToday.evaluate
    test('should return true for today', function () {
      const today = new Date().toISOString().split('T')[0]
      expect(evaluate(today)).toBe(true)
    })
    test('should return false for past dates', function () {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISO = yesterday.toISOString().split('T')[0]
      expect(evaluate(yesterdayISO)).toBe(false)
      expect(evaluate('2020-01-01')).toBe(false)
      expect(evaluate('1999-12-31')).toBe(false)
    })
    test('should return false for future dates', function () {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowISO = tomorrow.toISOString().split('T')[0]
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekISO = nextWeek.toISOString().split('T')[0]
      expect(evaluate(tomorrowISO)).toBe(false)
      expect(evaluate(nextWeekISO)).toBe(false)
      expect(evaluate('2999-12-31')).toBe(false)
    })
    test('should validate input type', function () {
      expect(function () {
        return evaluate(123)
      }).toThrow('Condition.Date.IsToday expects a string but received number')
    })
    test('should throw error when value is invalid date string', function () {
      expect(function () {
        return evaluate('invalid-date')
      }).toThrow('Condition.Date.IsToday: Invalid date string "invalid-date"')
      expect(function () {
        return evaluate('2024-13-01')
      }).toThrow('Condition.Date.IsToday: Invalid date string "2024-13-01"')
    })
    test('should build correct expression object', function () {
      const expr = dateConditions_1.DateConditions.IsToday()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsToday',
        arguments: [],
      })
    })
  })
})
