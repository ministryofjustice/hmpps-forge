Object.defineProperty(exports, '__esModule', { value: true })
const emailConditions_1 = require('./emailConditions')
const defineFunction_1 = require('../utils/defineFunction')
const enums_1 = require('../types/enums')

describe('EmailConditions', function () {
  const registry = (0, defineFunction_1.createFunctionsRegistry)(emailConditions_1.EmailConditionsImplementations)
  describe('IsValidEmail', function () {
    const evaluate = registry.IsValidEmail.evaluate
    test('should return true for valid email addresses', function () {
      expect(evaluate('test@example.com')).toBe(true)
      expect(evaluate('user.name@example.com')).toBe(true)
      expect(evaluate('user+tag@example.co.uk')).toBe(true)
      expect(evaluate('user_name@example-domain.com')).toBe(true)
      expect(evaluate('123@example.com')).toBe(true)
      expect(evaluate('a@b.co')).toBe(true)
      expect(evaluate('test.email@subdomain.example.com')).toBe(true)
      expect(evaluate('user%test@example.com')).toBe(true)
    })
    test('should return false for invalid email addresses', function () {
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
    test('should be case insensitive', function () {
      expect(evaluate('TEST@EXAMPLE.COM')).toBe(true)
      expect(evaluate('Test@Example.Com')).toBe(true)
      expect(evaluate('tEsT@eXaMpLe.CoM')).toBe(true)
    })
    test('should handle edge cases', function () {
      expect(evaluate('a@b.io')).toBe(true)
      expect(evaluate('test@sub.domain.example.com')).toBe(true)
      expect(evaluate('1234567890@example.com')).toBe(true)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123)
      }).toThrow('Condition.Email.IsValidEmail expects a string but received number')
      expect(function () {
        return evaluate(null)
      }).toThrow('Condition.Email.IsValidEmail expects a string but received object')
      expect(function () {
        return evaluate(undefined)
      }).toThrow('Condition.Email.IsValidEmail expects a string but received undefined')
      expect(function () {
        return evaluate([])
      }).toThrow('Condition.Email.IsValidEmail expects a string but received object')
      expect(function () {
        return evaluate({})
      }).toThrow('Condition.Email.IsValidEmail expects a string but received object')
    })
    test('should build correct expression object', function () {
      const expr = emailConditions_1.EmailConditions.IsValidEmail()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsValidEmail',
        arguments: [],
      })
    })
  })
})
