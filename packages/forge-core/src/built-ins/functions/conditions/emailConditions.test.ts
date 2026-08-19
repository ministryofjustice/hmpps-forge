import { EmailConditions, emailConditionsRegistry } from './emailConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('EmailConditions', () => {
  const harness = new FunctionRegistryTestHarness(emailConditionsRegistry)

  describe('IsValidEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('test@example.com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user.name@example.com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user+tag@example.co.uk')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user_name@example-domain.com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('123@example.com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('a@b.co')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('test.email@subdomain.example.com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user%test@example.com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user@example.verylongtld')).toBe(true)
    })

    test('should return true when the TLD is a real long TLD', () => {
      // Arrange
      const email = 'name@company.engineering'

      // Act
      const result = harness.evaluate(EmailConditions.IsValidEmail()).withInput(email)

      // Assert
      expect(result).toBe(true)
    })

    test('should return false for invalid email addresses', () => {
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('notanemail')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('@example.com')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user@')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user..name@example.com')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user@example')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user name@example.com')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user@.com')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('.user@example.com')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user.@example.com')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user@example..com')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('')).toBe(false)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('user@example.c')).toBe(false)
    })

    test('should return false without hanging when given adversarial backtracking input', () => {
      // Arrange
      const adversarial = `a@${'a'.repeat(10_000)}!`

      // Act
      const result = harness.evaluate(EmailConditions.IsValidEmail()).withInput(adversarial)

      // Assert
      expect(result).toBe(false)
    })

    test('should return true for a long but well-formed email under the length cap', () => {
      // Arrange
      const email = `${'a'.repeat(60)}@sub.example.co.uk`

      // Act
      const result = harness.evaluate(EmailConditions.IsValidEmail()).withInput(email)

      // Assert
      expect(result).toBe(true)
    })

    test('should return false when the address exceeds 254 characters', () => {
      // Arrange
      const email = `${'a'.repeat(250)}@example.com`

      // Act
      const result = harness.evaluate(EmailConditions.IsValidEmail()).withInput(email)

      // Assert
      expect(result).toBe(false)
    })

    test('should be case insensitive', () => {
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('TEST@EXAMPLE.COM')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('Test@Example.Com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('tEsT@eXaMpLe.CoM')).toBe(true)
    })

    test('should handle edge cases', () => {
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('a@b.io')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('test@sub.domain.example.com')).toBe(true)
      expect(harness.evaluate(EmailConditions.IsValidEmail()).withInput('1234567890@example.com')).toBe(true)
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
