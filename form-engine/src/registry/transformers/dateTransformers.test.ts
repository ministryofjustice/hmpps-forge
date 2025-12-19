import { DateTransformersRegistry } from './dateTransformers'

describe('DateTransformers', () => {
  describe('Format', () => {
    const { evaluate } = DateTransformersRegistry.Format

    it('should format date with DD/MM/YYYY pattern', () => {
      // Arrange
      const date = new Date(2024, 2, 15) // March 15, 2024

      // Act
      const result = evaluate(date, 'DD/MM/YYYY')

      // Assert
      expect(result).toBe('15/03/2024')
    })

    it('should format date with YYYY-MM-DD pattern', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = evaluate(date, 'YYYY-MM-DD')

      // Assert
      expect(result).toBe('2024-03-15')
    })

    it('should format date with time components', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = evaluate(date, 'DD/MM/YYYY HH:mm:ss')

      // Assert
      expect(result).toBe('15/03/2024 14:30:45')
    })

    it('should handle single-digit format tokens', () => {
      // Arrange
      const date = new Date(2024, 2, 5, 9, 5, 3) // March 5, 2024 09:05:03

      // Act
      const result = evaluate(date, 'D/M/YYYY H:m:s')

      // Assert
      expect(result).toBe('5/3/2024 9:5:3')
    })

    it('should throw on non-Date input', () => {
      // Act & Assert
      expect(() => evaluate('not a date', 'DD/MM/YYYY')).toThrow('expects a Date object')
    })
  })

  describe('AddDays', () => {
    const { evaluate } = DateTransformersRegistry.AddDays

    it('should add days to a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = evaluate(date, 7)

      // Assert
      expect(result.getDate()).toBe(22)
      expect(result.getMonth()).toBe(2)
    })

    it('should handle month rollover', () => {
      // Arrange
      const date = new Date(2024, 2, 30) // March 30

      // Act
      const result = evaluate(date, 5)

      // Assert
      expect(result.getMonth()).toBe(3) // April
      expect(result.getDate()).toBe(4)
    })

    it('should handle negative days', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = evaluate(date, -10)

      // Assert
      expect(result.getDate()).toBe(5)
    })
  })

  describe('SubtractDays', () => {
    const { evaluate } = DateTransformersRegistry.SubtractDays

    it('should subtract days from a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = evaluate(date, 7)

      // Assert
      expect(result.getDate()).toBe(8)
    })
  })

  describe('AddMonths', () => {
    const { evaluate } = DateTransformersRegistry.AddMonths

    it('should add months to a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15) // March 15

      // Act
      const result = evaluate(date, 3)

      // Assert
      expect(result.getMonth()).toBe(5) // June
      expect(result.getDate()).toBe(15)
    })

    it('should handle year rollover', () => {
      // Arrange
      const date = new Date(2024, 10, 15) // November 15

      // Act
      const result = evaluate(date, 3)

      // Assert
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(1) // February
    })
  })

  describe('AddYears', () => {
    const { evaluate } = DateTransformersRegistry.AddYears

    it('should add years to a date', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = evaluate(date, 5)

      // Assert
      expect(result.getFullYear()).toBe(2029)
    })

    it('should handle negative years', () => {
      // Arrange
      const date = new Date(2024, 2, 15)

      // Act
      const result = evaluate(date, -18)

      // Assert
      expect(result.getFullYear()).toBe(2006)
    })
  })

  describe('StartOfDay', () => {
    const { evaluate } = DateTransformersRegistry.StartOfDay

    it('should return midnight of the given date', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45, 123)

      // Act
      const result = evaluate(date)

      // Assert
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
      expect(result.getDate()).toBe(15)
    })
  })

  describe('EndOfDay', () => {
    const { evaluate } = DateTransformersRegistry.EndOfDay

    it('should return end of day for the given date', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = evaluate(date)

      // Assert
      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
      expect(result.getSeconds()).toBe(59)
      expect(result.getMilliseconds()).toBe(999)
      expect(result.getDate()).toBe(15)
    })
  })

  describe('ToISOString', () => {
    const { evaluate } = DateTransformersRegistry.ToISOString

    it('should convert date to ISO string', () => {
      // Arrange
      const date = new Date(Date.UTC(2024, 2, 15, 14, 30, 45, 123))

      // Act
      const result = evaluate(date)

      // Assert
      expect(result).toBe('2024-03-15T14:30:45.123Z')
    })
  })

  describe('ToLocaleString', () => {
    const { evaluate } = DateTransformersRegistry.ToLocaleString

    it('should convert date to locale string', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = evaluate(date)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should accept locale parameter', () => {
      // Arrange
      const date = new Date(2024, 2, 15, 14, 30, 45)

      // Act
      const result = evaluate(date, 'en-US')

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
      DateTransformersRegistry.AddDays.evaluate(original, 7)

      // Assert
      expect(original.getTime()).toBe(originalTime)
    })

    it('should not mutate the original date when adding months', () => {
      // Arrange
      const original = new Date(2024, 2, 15)
      const originalTime = original.getTime()

      // Act
      DateTransformersRegistry.AddMonths.evaluate(original, 3)

      // Assert
      expect(original.getTime()).toBe(originalTime)
    })
  })
})
