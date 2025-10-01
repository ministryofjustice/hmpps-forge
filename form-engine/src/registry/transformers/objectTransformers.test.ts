import { ObjectTransformers, ObjectTransformersRegistry } from './objectTransformers'
import { FunctionType } from '../../form/types/enums'

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
      expect(() => evaluate({ day: '32' }, { day: 'day' })).toThrow('Day must be between 1 and 31')
      expect(() => evaluate({ year: 'abc' }, { year: 'year' })).toThrow('Invalid year value')
    })

    it('should handle missing properties gracefully', () => {
      const dateObject = { month: '3', year: '2024' }
      const result = evaluate(dateObject, { year: 'year', month: 'month', day: 'missing' })
      expect(result).toBe('2024-03')
    })

    it('should throw errors for invalid inputs', () => {
      const paths = { year: 'year' }

      expect(() => evaluate(null, paths)).toThrow('expects an object')
      expect(() => evaluate('not-object', paths)).toThrow('expects an object')
      expect(() => evaluate({ year: '2024' }, null)).toThrow('requires a paths configuration')
      expect(() => evaluate({ other: 'value' }, { year: 'missing' })).toThrow('No valid date components found')
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
})
