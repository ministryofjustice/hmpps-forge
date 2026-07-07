import { EmailConditions, emailConditionsRegistry } from './emailConditions'
import { FunctionType } from '../types/enums'

describe('EmailConditions', () => {
  const registry = emailConditionsRegistry.build()

  describe('IsValidEmail', () => {
    const { evaluate } = registry['Email.IsValidEmail']

    test('should return true for valid email addresses', () => {
      expect(evaluate('test@example.com')).toBe(true)
      expect(evaluate('user.name@example.com')).toBe(true)
      expect(evaluate('user+tag@example.co.uk')).toBe(true)
      expect(evaluate('user_name@example-domain.com')).toBe(true)
      expect(evaluate('123@example.com')).toBe(true)
      expect(evaluate('a@b.co')).toBe(true)
      expect(evaluate('test.email@subdomain.example.com')).toBe(true)
      expect(evaluate('user%test@example.com')).toBe(true)
      expect(evaluate('user@example.verylongtld')).toBe(true)
    })

    test('should return true when the TLD is a real long TLD', () => {
      // Arrange
      const email = 'name@company.engineering'

      // Act
      const result = evaluate(email)

      // Assert
      expect(result).toBe(true)
    })

    test('should return false for invalid email addresses', () => {
      expect(evaluate('notanemail')).toBe(false)
      expect(evaluate('@example.com')).toBe(false)
      expect(evaluate('user@')).toBe(false)
      expect(evaluate('user..name@example.com')).toBe(false)
      expect(evaluate('user@example')).toBe(false)
      expect(evaluate('user name@example.com')).toBe(false)
      expect(evaluate('user@.com')).toBe(false)
      expect(evaluate('.user@example.com')).toBe(false)
      expect(evaluate('user.@example.com')).toBe(false)
      expect(evaluate('user@example..com')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('user@example.c')).toBe(false)
    })

    test('should return false without hanging when given adversarial backtracking input', () => {
      // Arrange
      const adversarial = `a@${'a'.repeat(10_000)}!`

      // Act
      const result = evaluate(adversarial)

      // Assert
      expect(result).toBe(false)
    })

    test('should return true for a long but well-formed email under the length cap', () => {
      // Arrange
      const email = `${'a'.repeat(60)}@sub.example.co.uk`

      // Act
      const result = evaluate(email)

      // Assert
      expect(result).toBe(true)
    })

    test('should return false when the address exceeds 254 characters', () => {
      // Arrange
      const email = `${'a'.repeat(250)}@example.com`

      // Act
      const result = evaluate(email)

      // Assert
      expect(result).toBe(false)
    })

    test('should be case insensitive', () => {
      expect(evaluate('TEST@EXAMPLE.COM')).toBe(true)
      expect(evaluate('Test@Example.Com')).toBe(true)
      expect(evaluate('tEsT@eXaMpLe.CoM')).toBe(true)
    })

    test('should handle edge cases', () => {
      expect(evaluate('a@b.io')).toBe(true)
      expect(evaluate('test@sub.domain.example.com')).toBe(true)
      expect(evaluate('1234567890@example.com')).toBe(true)
    })

    test('should build correct expression object', () => {
      const expr = EmailConditions.IsValidEmail()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Email.IsValidEmail',
        arguments: [],
      })
    })
  })
})
