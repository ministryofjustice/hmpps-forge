import EmailConditions from './emailConditions'

describe('EmailConditions', () => {
  describe('IsValidEmail', () => {
    const { evaluate } = EmailConditions.IsValidEmail.spec

    test('should return true for valid email addresses', () => {
      expect(evaluate('test@example.com')).toBe(true)
      expect(evaluate('user.name@example.com')).toBe(true)
      expect(evaluate('user+tag@example.co.uk')).toBe(true)
      expect(evaluate('user_name@example-domain.com')).toBe(true)
      expect(evaluate('123@example.com')).toBe(true)
      expect(evaluate('a@b.co')).toBe(true)
      expect(evaluate('test.email@subdomain.example.com')).toBe(true)
      expect(evaluate('user%test@example.com')).toBe(true)
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
      expect(evaluate('user@example.verylongtld')).toBe(false)
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

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123)).toThrow('Condition.Email.IsValidEmail expects a string but received number')
      expect(() => evaluate(null)).toThrow('Condition.Email.IsValidEmail expects a string but received object')
      expect(() => evaluate(undefined)).toThrow('Condition.Email.IsValidEmail expects a string but received undefined')
      expect(() => evaluate([])).toThrow('Condition.Email.IsValidEmail expects a string but received object')
      expect(() => evaluate({})).toThrow('Condition.Email.IsValidEmail expects a string but received object')
    })

    test('should build correct expression object', () => {
      const expr = EmailConditions.IsValidEmail()
      expect(expr).toEqual({
        type: 'function',
        name: 'isValidEmail',
        arguments: [],
      })
    })
  })
})
