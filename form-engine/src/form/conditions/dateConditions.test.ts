import DateConditions from './dateConditions'

describe('DateConditions', () => {
  describe('IsValidYear', () => {
    const { evaluate } = DateConditions.IsValidYear.spec

    test('should return true for valid 4-digit years', () => {
      expect(evaluate(2024)).toBe(true)
      expect(evaluate(1000)).toBe(true)
      expect(evaluate(9999)).toBe(true)
      expect(evaluate(1900)).toBe(true)
      expect(evaluate(2000)).toBe(true)
    })

    test('should return false for years outside valid range', () => {
      expect(evaluate(999)).toBe(false)
      expect(evaluate(10000)).toBe(false)
      expect(evaluate(0)).toBe(false)
      expect(evaluate(-2024)).toBe(false)
    })

    test('should return false for non-integer years', () => {
      expect(evaluate(2024.5)).toBe(false)
      expect(evaluate(2024.1)).toBe(false)
      expect(evaluate(1999.999)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate('2024')).toThrow('Condition.Date.IsValidMonth expects a number but received string')
      expect(() => evaluate(null)).toThrow('Condition.Date.IsValidMonth expects a number but received object')
      expect(() => evaluate(undefined)).toThrow('Condition.Date.IsValidMonth expects a number but received undefined')
      expect(() => evaluate(true)).toThrow('Condition.Date.IsValidMonth expects a number but received boolean')
      expect(() => evaluate(NaN)).toThrow('Condition.Date.IsValidMonth expects a number but received NaN')
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsValidYear()
      expect(expr).toEqual({
        type: 'function',
        name: 'dateIsValidYear',
        arguments: [],
      })
    })
  })

  describe('IsValidMonth', () => {
    const { evaluate } = DateConditions.IsValidMonth.spec

    test('should return true for valid months (1-12)', () => {
      expect(evaluate(1)).toBe(true)
      expect(evaluate(6)).toBe(true)
      expect(evaluate(12)).toBe(true)
      expect(evaluate(2)).toBe(true)
      expect(evaluate(11)).toBe(true)
    })

    test('should return false for invalid months', () => {
      expect(evaluate(0)).toBe(false)
      expect(evaluate(13)).toBe(false)
      expect(evaluate(-1)).toBe(false)
      expect(evaluate(100)).toBe(false)
    })

    test('should reject decimal values', () => {
      expect(evaluate(0.5)).toBe(false)
      expect(evaluate(13.1)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate('6')).toThrow('Condition.Date.IsValidMonth expects a number but received string')
      expect(() => evaluate([])).toThrow('Condition.Date.IsValidMonth expects a number but received object')
      expect(() => evaluate(false)).toThrow('Condition.Date.IsValidMonth expects a number but received boolean')
      expect(() => evaluate(NaN)).toThrow('Condition.Date.IsValidMonth expects a number but received NaN')
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsValidMonth()
      expect(expr).toEqual({
        type: 'function',
        name: 'dateIsValidMonth',
        arguments: [],
      })
    })
  })

  describe('IsValidDay', () => {
    const { evaluate } = DateConditions.IsValidDay.spec

    test('should return true for valid days (1-31)', () => {
      expect(evaluate(1)).toBe(true)
      expect(evaluate(15)).toBe(true)
      expect(evaluate(31)).toBe(true)
      expect(evaluate(28)).toBe(true)
      expect(evaluate(30)).toBe(true)
    })

    test('should return false for invalid days', () => {
      expect(evaluate(0)).toBe(false)
      expect(evaluate(32)).toBe(false)
      expect(evaluate(-1)).toBe(false)
      expect(evaluate(100)).toBe(false)
    })

    test('should reject decimal values', () => {
      expect(evaluate(1.5)).toBe(false)
      expect(evaluate(12.2)).toBe(false)
    })

    test('should throw error when value is not a number', () => {
      expect(() => evaluate('15')).toThrow('Condition.Date.IsValidDay expects a number but received string')
      expect(() => evaluate(null)).toThrow('Condition.Date.IsValidDay expects a number but received object')
      expect(() => evaluate(undefined)).toThrow('Condition.Date.IsValidDay expects a number but received undefined')
      expect(() => evaluate(NaN)).toThrow('Condition.Date.IsValidDay expects a number but received NaN')
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsValidDay()
      expect(expr).toEqual({
        type: 'function',
        name: 'dateIsValidDay',
        arguments: [],
      })
    })
  })

  describe('IsBefore', () => {
    const { evaluate } = DateConditions.IsBefore.spec

    test('should return true when date is before comparison date', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-06-01')
      const date3 = new Date('2023-12-31')

      expect(evaluate(date1, '2024-12-31')).toBe(true)
      expect(evaluate(date2, '2024-12-31')).toBe(true)
      expect(evaluate(date3, '2024-01-01')).toBe(true)
    })

    test('should return false when date is equal to comparison date', () => {
      const date = new Date('2024-01-01T00:00:00')
      expect(evaluate(date, '2024-01-01T00:00:00')).toBe(false)
    })

    test('should return false when date is after comparison date', () => {
      const date1 = new Date('2024-12-31')
      const date2 = new Date('2024-01-02')

      expect(evaluate(date1, '2024-01-01')).toBe(false)
      expect(evaluate(date2, '2024-01-01')).toBe(false)
    })

    test('should handle various date string formats', () => {
      const date = new Date('2024-01-15')

      expect(evaluate(date, '2024-02-01')).toBe(true)
      expect(evaluate(date, '2024/02/01')).toBe(true)
      expect(evaluate(date, 'February 1, 2024')).toBe(true)
      expect(evaluate(date, '2024-02-01T10:30:00')).toBe(true)
    })

    test('should handle time components correctly', () => {
      const date = new Date('2024-01-01T12:00:00')

      expect(evaluate(date, '2024-01-01T13:00:00')).toBe(true)
      expect(evaluate(date, '2024-01-01T11:00:00')).toBe(false)
    })

    test('should throw error when value is not a Date', () => {
      expect(() => evaluate('2024-01-01', '2024-12-31')).toThrow(
        'Condition.Date.IsBefore expects a Date object but received string',
      )
      expect(() => evaluate(1704067200000, '2024-12-31')).toThrow(
        'Condition.Date.IsBefore expects a Date object but received number',
      )
      expect(() => evaluate(null, '2024-12-31')).toThrow(
        'Condition.Date.IsBefore expects a Date object but received object',
      )
    })

    test('should throw error when comparison date string is invalid', () => {
      const date = new Date('2024-01-01')

      expect(() => evaluate(date, 'invalid-date')).toThrow(
        'Condition.Date.IsBefore: Invalid comparison date string "invalid-date"',
      )
      expect(() => evaluate(date, '')).toThrow('Condition.Date.IsBefore: Invalid comparison date string ""')
      expect(() => evaluate(date, '2024-13-01')).toThrow(
        'Condition.Date.IsBefore: Invalid comparison date string "2024-13-01"',
      )
    })

    test('should throw error for invalid Date objects', () => {
      const invalidDate = new Date('invalid')

      expect(() => evaluate(invalidDate, '2024-01-01')).toThrow(
        'Condition.Date.IsBefore received an invalid Date object',
      )
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsBefore('2024-12-31')
      expect(expr).toEqual({
        type: 'function',
        name: 'isDateBefore',
        arguments: ['2024-12-31'],
      })
    })
  })

  describe('IsAfter', () => {
    const { evaluate } = DateConditions.IsAfter.spec

    test('should return true when date is after comparison date', () => {
      const date1 = new Date('2024-12-31')
      const date2 = new Date('2024-06-01')
      const date3 = new Date('2024-01-02')

      expect(evaluate(date1, '2024-01-01')).toBe(true)
      expect(evaluate(date2, '2024-01-01')).toBe(true)
      expect(evaluate(date3, '2024-01-01')).toBe(true)
    })

    test('should return false when date is equal to comparison date', () => {
      const date = new Date('2024-01-01T00:00:00')
      expect(evaluate(date, '2024-01-01T00:00:00')).toBe(false)
    })

    test('should return false when date is before comparison date', () => {
      const date1 = new Date('2023-12-31')
      const date2 = new Date('2024-01-01')

      expect(evaluate(date1, '2024-01-01')).toBe(false)
      expect(evaluate(date2, '2024-12-31')).toBe(false)
    })

    test('should handle various date string formats', () => {
      const date = new Date('2024-02-15')

      expect(evaluate(date, '2024-02-01')).toBe(true)
      expect(evaluate(date, '2024/02/01')).toBe(true)
      expect(evaluate(date, 'February 1, 2024')).toBe(true)
      expect(evaluate(date, '2024-02-01T10:30:00')).toBe(true)
    })

    test('should handle time components correctly', () => {
      const date = new Date('2024-01-01T12:00:00')

      expect(evaluate(date, '2024-01-01T11:00:00')).toBe(true)
      expect(evaluate(date, '2024-01-01T13:00:00')).toBe(false)
    })

    test('should throw error when value is not a Date', () => {
      expect(() => evaluate('2024-12-31', '2024-01-01')).toThrow(
        'Condition.Date.IsAfter expects a Date object but received string',
      )
      expect(() => evaluate(1704067200000, '2024-01-01')).toThrow(
        'Condition.Date.IsAfter expects a Date object but received number',
      )
      expect(() => evaluate({}, '2024-01-01')).toThrow(
        'Condition.Date.IsAfter expects a Date object but received object',
      )
    })

    test('should throw error when comparison date string is invalid', () => {
      const date = new Date('2024-01-01')

      expect(() => evaluate(date, 'not-a-date')).toThrow(
        'Condition.Date.IsAfter: Invalid comparison date string "not-a-date"',
      )
      expect(() => evaluate(date, '')).toThrow('Condition.Date.IsAfter: Invalid comparison date string ""')
      expect(() => evaluate(date, '2024-00-01')).toThrow(
        'Condition.Date.IsAfter: Invalid comparison date string "2024-00-01"',
      )
    })

    test('should throw error for invalid Date objects', () => {
      const invalidDate = new Date('invalid')

      expect(() => evaluate(invalidDate, '2024-01-01')).toThrow(
        'Condition.Date.IsAfter received an invalid Date object',
      )
    })

    test('should build correct expression object', () => {
      const expr = DateConditions.IsAfter('2024-01-01')
      expect(expr).toEqual({
        type: 'function',
        name: 'isDateAfter',
        arguments: ['2024-01-01'],
      })
    })
  })
})
