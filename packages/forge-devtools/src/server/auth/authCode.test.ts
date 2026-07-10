import { generateCode, validateCode } from './authCode'

describe('authCode', () => {
  describe('generateCode()', () => {
    it('should generate a 5-character uppercase alphanumeric code', () => {
      // Arrange & Act
      const pending = generateCode()

      // Assert
      expect(pending.code).toMatch(/^[A-Z0-9]{5}$/)
    })

    it('should set expiry 30 seconds in the future', () => {
      // Arrange
      const before = Date.now()

      // Act
      const pending = generateCode()

      // Assert
      expect(pending.expiresAt).toBeGreaterThanOrEqual(before + 300_000)
      expect(pending.expiresAt).toBeLessThanOrEqual(Date.now() + 300_000)
    })

    it('should start with zero attempts', () => {
      // Arrange & Act
      const pending = generateCode()

      // Assert
      expect(pending.attempts).toBe(0)
    })
  })

  describe('validateCode()', () => {
    it('should return valid when the code matches', () => {
      // Arrange
      const pending = generateCode()

      // Act
      const result = validateCode(pending, pending.code)

      // Assert
      expect(result).toBe('valid')
    })

    it('should accept case-insensitive input', () => {
      // Arrange
      const pending = generateCode()

      // Act
      const result = validateCode(pending, pending.code.toLowerCase())

      // Assert
      expect(result).toBe('valid')
    })

    it('should return invalid when the code does not match', () => {
      // Arrange
      const pending = generateCode()

      // Act
      const result = validateCode(pending, 'WRONG')

      // Assert
      expect(result).toBe('invalid')
    })

    it('should return max-attempts after 3 failed attempts', () => {
      // Arrange
      const pending = generateCode()

      // Act
      validateCode(pending, 'WRONG')
      validateCode(pending, 'WRONG')
      const result = validateCode(pending, 'WRONG')

      // Assert
      expect(result).toBe('max-attempts')
    })

    it('should return max-attempts when attempting after 3 failures', () => {
      // Arrange
      const pending = generateCode()
      validateCode(pending, 'WRONG')
      validateCode(pending, 'WRONG')
      validateCode(pending, 'WRONG')

      // Act
      const result = validateCode(pending, pending.code)

      // Assert
      expect(result).toBe('max-attempts')
    })

    it('should return expired when the code has expired', () => {
      // Arrange
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1000 + 300_001)
      const pending = generateCode()

      // Act
      const result = validateCode(pending, pending.code)

      // Assert
      expect(result).toBe('expired')
    })
  })
})
