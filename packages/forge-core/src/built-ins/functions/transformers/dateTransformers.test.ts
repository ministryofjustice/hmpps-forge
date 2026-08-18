import { DateTransformers, dateTransformersRegistry } from './dateTransformers'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('DateTransformers', () => {
  const harness = new FunctionRegistryTestHarness(dateTransformersRegistry)

  describe('Format', () => {
    it('should format date with DD/MM/YYYY pattern', () => {
      // Arrange
      const date = new Date(2024, 2, 15) // March 15, 2024

      // Act
      const result = harness.evaluate(DateTransformers.Format('DD/MM/YYYY')).withInput(date)

      // Assert
      expect(result).toBe('15/03/2024')
    })

    it('should format date with YYYY-MM-DD pattern', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = harness.evaluate(DateTransformers.Format('YYYY-MM-DD')).withInput(date)

      // Assert
      expect(result).toBe('2024-03-15')
    })

    it('should format date with time components', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = harness.evaluate(DateTransformers.Format('DD/MM/YYYY HH:mm:ss')).withInput(date)

      // Assert
      expect(result).toBe('15/03/2024 14:30:45')
    })

    it('should handle single-digit format tokens', () => {
      // Arrange
      const date = new Date(2024, 2, 5, 9, 5, 3) // March 5, 2024 09:05:03

      // Act
      const result = harness.evaluate(DateTransformers.Format('D/M/YYYY H:m:s')).withInput(date)

      // Assert
      expect(result).toBe('5/3/2024 9:5:3')
    })

    it('should throw on non-Date input', () => {
      // Act & Assert
      expect(() => harness.evaluate(DateTransformers.Format('DD/MM/YYYY')).withInput('not a date')).toThrow(
        'Date.Format: value failed schema validation',
      )
    })
  })

  describe('AddDays', () => {
    it('should add days to a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = harness.evaluate(DateTransformers.AddDays(7)).withInput(date) as Date

      // Assert
      expect(result.getDate()).toBe(22)
      expect(result.getMonth()).toBe(2)
    })

    it('should handle month rollover', () => {
      // Arrange
      const date = new Date(2024, 2, 30) // March 30

      // Act
      const result = harness.evaluate(DateTransformers.AddDays(5)).withInput(date) as Date

      // Assert
      expect(result.getMonth()).toBe(3) // April
      expect(result.getDate()).toBe(4)
    })

    it('should handle negative days', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = harness.evaluate(DateTransformers.AddDays(-10)).withInput(date) as Date

      // Assert
      expect(result.getDate()).toBe(5)
    })
  })

  describe('SubtractDays', () => {
    it('should subtract days from a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = harness.evaluate(DateTransformers.SubtractDays(7)).withInput(date) as Date

      // Assert
      expect(result.getDate()).toBe(8)
    })
  })

  describe('AddMonths', () => {
    it('should add months to a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15) // March 15

      // Act
      const result = harness.evaluate(DateTransformers.AddMonths(3)).withInput(date) as Date

      // Assert
      expect(result.getMonth()).toBe(5) // June
      expect(result.getDate()).toBe(15)
    })

    it('should handle year rollover', () => {
      // Arrange
      const date = new Date(2024, 10, 15) // November 15

      // Act
      const result = harness.evaluate(DateTransformers.AddMonths(3)).withInput(date) as Date

      // Assert
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(1) // February
    })
  })

  describe('AddYears', () => {
    it('should add years to a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = harness.evaluate(DateTransformers.AddYears(5)).withInput(date) as Date

      // Assert
      expect(result.getFullYear()).toBe(2029)
    })

    it('should handle negative years', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = harness.evaluate(DateTransformers.AddYears(-18)).withInput(date) as Date

      // Assert
      expect(result.getFullYear()).toBe(2006)
    })
  })

  describe('StartOfDay', () => {
    it('should return midnight of the given date', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45, 123)

      // Act
      const result = harness.evaluate(DateTransformers.StartOfDay()).withInput(date) as Date

      // Assert
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
      expect(result.getDate()).toBe(15)
    })
  })

  describe('EndOfDay', () => {
    it('should return end of day for the given date', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = harness.evaluate(DateTransformers.EndOfDay()).withInput(date) as Date

      // Assert
      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
      expect(result.getSeconds()).toBe(59)
      expect(result.getMilliseconds()).toBe(999)
      expect(result.getDate()).toBe(15)
    })
  })

  describe('ToISOString', () => {
    it('should convert date to ISO string', () => {
      // Arrange
      const date = new Date(Date.UTC(2024, 2, 15, 14, 30, 45, 123))

      // Act
      const result = harness.evaluate(DateTransformers.ToISOString()).withInput(date)

      // Assert
      expect(result).toBe('2024-03-15T14:30:45.123Z')
    })
  })

  describe('ToLocaleString', () => {
    it('should convert date to locale string', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = harness.evaluate(DateTransformers.ToLocaleString()).withInput(date) as string

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should accept locale parameter', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = harness.evaluate(DateTransformers.ToLocaleString('en-US')).withInput(date)

      // Assert
      expect(typeof result).toBe('string')
    })
  })

  describe('immutability', () => {
    it('should not mutate the original date when adding days', () => {
      // Arrange
      const original = new Date(2024, 2, 15)
      const originalTime = original.getTime()

      // Act
      harness.evaluate(DateTransformers.AddDays(7)).withInput(original)

      // Assert
      expect(original.getTime()).toBe(originalTime)
    })

    it('should not mutate the original date when adding months', () => {
      // Arrange
      const original = new Date(2024, 2, 15)
      const originalTime = original.getTime()

      // Act
      harness.evaluate(DateTransformers.AddMonths(3)).withInput(original)

      // Assert
      expect(original.getTime()).toBe(originalTime)
    })
  })
})
