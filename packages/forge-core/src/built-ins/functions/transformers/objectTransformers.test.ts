import { ObjectTransformers, objectTransformersRegistry, type DateParts } from './objectTransformers'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('Object Transformers', () => {
  const harness = new FunctionRegistryTestHarness(objectTransformersRegistry)

  describe('ToISO', () => {
    it('should convert date objects to ISO format with zero-padding', () => {
      const dateObject = { day: '5', month: '3', year: '2024' }
      const paths = { year: 'year', month: 'month', day: 'day' }
      const result = harness.evaluate(ObjectTransformers.ToISO(paths)).withInput(dateObject)
      expect(result).toBe('2024-03-05')
    })

    it('should handle partial dates for different use cases', () => {
      // Credit card expiry (month/year)
      expect(
        harness
          .evaluate(ObjectTransformers.ToISO({ month: 'month', year: 'year' }))
          .withInput({ month: '12', year: '2027' }),
      ).toBe('2027-12')

      // Recurring birthday (month/day)
      expect(
        harness.evaluate(ObjectTransformers.ToISO({ month: 'month', day: 'day' })).withInput({ month: '7', day: '15' }),
      ).toBe('--07-15')

      // Year only
      expect(harness.evaluate(ObjectTransformers.ToISO({ year: 'year' })).withInput({ year: '2024' })).toBe('2024')
    })

    it('should work with nested objects and custom property names', () => {
      const nested = {
        birth: { year: '1990', month: '05', day: '15' },
      }
      const custom = { jour: '28', mois: '2', annee: '2024' }

      expect(
        harness
          .evaluate(ObjectTransformers.ToISO({ year: 'birth.year', month: 'birth.month', day: 'birth.day' }))
          .withInput(nested),
      ).toBe('1990-05-15')
      expect(
        harness.evaluate(ObjectTransformers.ToISO({ day: 'jour', month: 'mois', year: 'annee' })).withInput(custom),
      ).toBe('2024-02-28')
    })

    it('should validate date component ranges', () => {
      expect(() => harness.evaluate(ObjectTransformers.ToISO({ month: 'month' })).withInput({ month: '13' })).toThrow(
        'Month must be between 1 and 12',
      )
      expect(() => harness.evaluate(ObjectTransformers.ToISO({ month: 'month' })).withInput({ month: '13' })).toThrow(
        TypeError,
      )
      expect(() => harness.evaluate(ObjectTransformers.ToISO({ day: 'day' })).withInput({ day: '32' })).toThrow(
        'Day must be between 1 and 31',
      )
      expect(() => harness.evaluate(ObjectTransformers.ToISO({ day: 'day' })).withInput({ day: '32' })).toThrow(
        TypeError,
      )
      expect(() => harness.evaluate(ObjectTransformers.ToISO({ year: 'year' })).withInput({ year: 'abc' })).toThrow(
        'Invalid year value',
      )
      expect(() => harness.evaluate(ObjectTransformers.ToISO({ year: 'year' })).withInput({ year: 'abc' })).toThrow(
        TypeError,
      )
    })

    it('should handle missing properties gracefully', () => {
      const dateObject = { month: '3', year: '2024' }
      const result = harness.evaluate(ObjectTransformers.ToISO({ year: 'year', month: 'month' })).withInput(dateObject)
      expect(result).toBe('2024-03')
    })

    it('should throw errors for invalid inputs', () => {
      const paths = { year: 'year' }

      expect(() => harness.evaluate(ObjectTransformers.ToISO(paths)).withInput(null)).toThrow(
        'Object.ToISO: value failed schema validation',
      )
      expect(() => harness.evaluate(ObjectTransformers.ToISO(paths)).withInput('not-object')).toThrow(
        'Object.ToISO: value failed schema validation',
      )
      expect(() =>
        harness.evaluate(ObjectTransformers.ToISO(null as unknown as DateParts)).withInput({ year: '2024' }),
      ).toThrow('Object.ToISO: arguments failed schema validation')
      expect(() =>
        harness.evaluate(ObjectTransformers.ToISO({ year: 'missing' })).withInput({ other: 'value' }),
      ).toThrow('No valid date components found')
      expect(() =>
        harness.evaluate(ObjectTransformers.ToISO({ year: 'missing' })).withInput({ other: 'value' }),
      ).toThrow(TypeError)
    })

    it('should return correct function expression', () => {
      const paths = { year: 'year', month: 'month', day: 'day' }
      const expr = ObjectTransformers.ToISO(paths)
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'Object.ToISO',
        arguments: [paths],
      })
    })
  })

  describe('FromISO', () => {
    it('should convert full ISO date to object', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act
      const result = harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('2024-03-15')

      // Assert
      expect(result).toEqual({ year: '2024', month: '03', day: '15' })
    })

    it('should convert year-month ISO to object', () => {
      // Arrange
      const paths = { year: 'year', month: 'month' }

      // Act
      const result = harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('2025-03')

      // Assert
      expect(result).toEqual({ year: '2025', month: '03' })
    })

    it('should convert month-day to object', () => {
      // Arrange
      const paths = { month: 'month', day: 'day' }

      // Act / Assert
      expect(harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('12-25')).toEqual({ month: '12', day: '25' })
      expect(harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('--12-25')).toEqual({
        month: '12',
        day: '25',
      })
    })

    it('should convert year-only to object', () => {
      // Arrange
      const paths = { year: 'year' }

      // Act
      const result = harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('2024')

      // Assert
      expect(result).toEqual({ year: '2024' })
    })

    it('should pass through objects unchanged', () => {
      // Arrange
      const obj = { day: '31', month: '03', year: '1980' }
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act
      const result = harness.evaluate(ObjectTransformers.FromISO(paths)).withInput(obj)

      // Assert
      expect(result).toBe(obj)
    })

    it('should use custom property names from paths', () => {
      // Arrange
      const paths = { day: 'jour', month: 'mois', year: 'annee' }

      // Act
      const result = harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('2024-02-28')

      // Assert
      expect(result).toEqual({ annee: '2024', mois: '02', jour: '28' })
    })

    it('should return empty object for undefined or empty values', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act / Assert
      // An undefined input short-circuits to undefined without calling the transformer.
      expect(harness.evaluate(ObjectTransformers.FromISO(paths)).withInput(undefined)).toBeUndefined()
      expect(harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('')).toEqual({})
      expect(harness.evaluate(ObjectTransformers.FromISO(paths)).withInput(null)).toEqual({})
    })

    it('should return empty object for invalid formats', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }

      // Act / Assert
      expect(harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('not-a-date')).toEqual({})
      expect(harness.evaluate(ObjectTransformers.FromISO(paths)).withInput('2024/03/15')).toEqual({})
    })

    it('should be the inverse of ToISO', () => {
      // Arrange
      const paths = { year: 'year', month: 'month', day: 'day' }
      const original = { day: '5', month: '3', year: '2024' }

      // Act
      const iso = harness.evaluate(ObjectTransformers.ToISO(paths)).withInput(original)
      const restored = harness.evaluate(ObjectTransformers.FromISO(paths)).withInput(iso)

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
        name: 'Object.FromISO',
        arguments: [paths],
      })
    })
  })
})
