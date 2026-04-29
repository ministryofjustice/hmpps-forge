import { ObjectTransformers, ObjectTransformersRegistry } from './objectTransformers'
import { FunctionType } from '../types/enums'

describe('Object Transformers', () => {
  describe('ToISO', () => {
    const { evaluate } = ObjectTransformersRegistry.ToISO

    it('should convert date objects to ISO format with zero-padding', () => {
      const dateObject = { day: '5', month: '3', year: '2024' }
      const paths = { year: 'year', month: 'month', day: 'day' }
      const result = evaluate(dateObject, paths)
      expect(result).toBe('2024-03-05')
    })

    it('should handle partial dates for different use cases', () => {
      // Credit card expiry (month/year)
      expect(evaluate({ month: '12', year: '2027' }, { month: 'month', year: 'year' })).toBe('2027-12')

      // Recurring birthday (month/day)
      expect(evaluate({ month: '7', day: '15' }, { month: 'month', day: 'day' })).toBe('--07-15')

      // Year only
      expect(evaluate({ year: '2024' }, { year: 'year' })).toBe('2024')
    })

    it('should work with nested objects and custom property names', () => {
      const nested = {
        birth: { year: '1990', month: '05', day: '15' },
      }
      const custom = { jour: '28', mois: '2', annee: '2024' }

      expect(evaluate(nested, { year: 'birth.year', month: 'birth.month', day: 'birth.day' })).toBe('1990-05-15')
      expect(evaluate(custom, { day: 'jour', month: 'mois', year: 'annee' })).toBe('2024-02-28')
    })

    it('should validate date component ranges', () => {
      expect(() => evaluate({ month: '13' }, { month: 'month' })).toThrow('Month must be between 1 and 12')
      expect(() => evaluate({ month: '13' }, { month: 'month' })).toThrow(TypeError)
      expect(() => evaluate({ day: '32' }, { day: 'day' })).toThrow('Day must be between 1 and 31')
      expect(() => evaluate({ day: '32' }, { day: 'day' })).toThrow(TypeError)
      expect(() => evaluate({ year: 'abc' }, { year: 'year' })).toThrow('Invalid year value')
      expect(() => evaluate({ year: 'abc' }, { year: 'year' })).toThrow(TypeError)
    })

    it('should handle missing properties gracefully', () => {
      const dateObject = { month: '3', year: '2024' }
      const result = evaluate(dateObject, { year: 'year', month: 'month' })
      expect(result).toBe('2024-03')
    })

    it('should throw errors for invalid inputs', () => {
      const paths = { year: 'year' }

      expect(() => evaluate(null, paths)).toThrow('expects an object')
      expect(() => evaluate('not-object', paths)).toThrow('expects an object')
      expect(() => evaluate({ year: '2024' }, null)).toThrow('requires a paths configuration')
      expect(() => evaluate({ other: 'value' }, { year: 'missing' })).toThrow('No valid date components found')
      expect(() => evaluate({ other: 'value' }, { year: 'missing' })).toThrow(TypeError)
    })

    it('should return correct function expression', () => {
      const paths = { year: 'year', month: 'month', day: 'day' }
      const expr = ObjectTransformers.ToISO(paths)
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToISO',
        arguments: [paths],
      })
    })
  })

  describe('FromISO', () => {
    const { evaluate } = ObjectTransformersRegistry.FromISO

    it('should convert full ISO date to object', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act
      const result = evaluate('2024-03-15', paths)

      // Assert
      expect(result).toEqual({ year: '2024', month: '03', day: '15' })
    })

    it('should convert year-month ISO to object', () => {
      // Arrange
      const paths = { year: 'year', month: 'month' }

      // Act
      const result = evaluate('2025-03', paths)

      // Assert
      expect(result).toEqual({ year: '2025', month: '03' })
    })

    it('should convert month-day to object', () => {
      // Arrange
      const paths = { month: 'month', day: 'day' }

      // Act / Assert
      expect(evaluate('12-25', paths)).toEqual({ month: '12', day: '25' })
      expect(evaluate('--12-25', paths)).toEqual({ month: '12', day: '25' })
    })

    it('should convert year-only to object', () => {
      // Arrange
      const paths = { year: 'year' }

      // Act
      const result = evaluate('2024', paths)

      // Assert
      expect(result).toEqual({ year: '2024' })
    })

    it('should pass through objects unchanged', () => {
      // Arrange
      const obj = { day: '31', month: '03', year: '1980' }
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act
      const result = evaluate(obj, paths)

      // Assert
      expect(result).toBe(obj)
    })

    it('should use custom property names from paths', () => {
      // Arrange
      const paths = { day: 'jour', month: 'mois', year: 'annee' }

      // Act
      const result = evaluate('2024-02-28', paths)

      // Assert
      expect(result).toEqual({ annee: '2024', mois: '02', jour: '28' })
    })

    it('should return empty object for undefined or empty values', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act / Assert
      expect(evaluate(undefined, paths)).toEqual({})
      expect(evaluate('', paths)).toEqual({})
      expect(evaluate(null, paths)).toEqual({})
    })

    it('should return empty object for invalid formats', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act / Assert
      expect(evaluate('not-a-date', paths)).toEqual({})
      expect(evaluate('2024/03/15', paths)).toEqual({})
    })

    it('should be the inverse of ToISO', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }
      const original = { day: '5', month: '3', year: '2024' }

      // Act
      const iso = ObjectTransformersRegistry.ToISO.evaluate(original, paths)
      const restored = evaluate(iso, paths)

      // Assert
      expect(restored).toEqual({ year: '2024', month: '03', day: '05' })
    })

    it('should return correct function expression', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act
      const expr = ObjectTransformers.FromISO(paths)

      // Assert
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'FromISO',
        arguments: [paths],
      })
    })
  })
})
