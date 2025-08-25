import PhoneConditions from './phoneConditions'
import { FunctionType } from '../types/enums'

describe('PhoneConditions', () => {
  describe('IsValidPhoneNumber', () => {
    const { evaluate } = PhoneConditions.IsValidPhoneNumber.spec

    test('should return true for valid phone numbers', () => {
      expect(evaluate('1234567')).toBe(true)
      expect(evaluate('123-456-7890')).toBe(true)
      expect(evaluate('(123) 456-7890')).toBe(true)
      expect(evaluate('+1 234 567 8900')).toBe(true)
      expect(evaluate('+44 20 7123 4567')).toBe(true)
      expect(evaluate('020 7123 4567')).toBe(true)
      expect(evaluate('123.456.7890')).toBe(true)
      expect(evaluate('+1-234-567-8900')).toBe(true)
      expect(evaluate('12345678901234567890')).toBe(true)
    })

    test('should return false for invalid phone numbers', () => {
      expect(evaluate('123456')).toBe(false)
      expect(evaluate('123456789012345678901')).toBe(false)
      expect(evaluate('phone')).toBe(false)
      expect(evaluate('123@456')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('++123456789')).toBe(false)
      expect(evaluate('123#456#7890')).toBe(false)
    })

    test('should handle international formats', () => {
      expect(evaluate('+1 (555) 123-4567')).toBe(true)
      expect(evaluate('+44 20 7946 0958')).toBe(true)
      expect(evaluate('+33 1 42 86 82 00')).toBe(true)
      expect(evaluate('+49 30 12345678')).toBe(true)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123456789)).toThrow(
        'Condition.Phone.IsValidPhoneNumber expects a string but received number',
      )
      expect(() => evaluate(null)).toThrow('Condition.Phone.IsValidPhoneNumber expects a string but received object')
      expect(() => evaluate(undefined)).toThrow(
        'Condition.Phone.IsValidPhoneNumber expects a string but received undefined',
      )
      expect(() => evaluate([])).toThrow('Condition.Phone.IsValidPhoneNumber expects a string but received object')
    })

    test('should build correct expression object', () => {
      const expr = PhoneConditions.IsValidPhoneNumber()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'isValidPhoneNumber',
        arguments: [],
      })
    })
  })

  describe('IsValidUKMobile', () => {
    const { evaluate } = PhoneConditions.IsValidUKMobile.spec

    test('should return true for valid UK mobile numbers', () => {
      expect(evaluate('07123456789')).toBe(true)
      expect(evaluate('07123 456789')).toBe(true)
      expect(evaluate('07123 456 789')).toBe(true)
      expect(evaluate('+447123456789')).toBe(true)
      expect(evaluate('+44 7123 456789')).toBe(true)
      expect(evaluate('+44 7123 456 789')).toBe(true)
      expect(evaluate('(07123) 456789')).toBe(true)
      expect(evaluate('(07123) 456 789')).toBe(true)
      expect(evaluate('07987654321')).toBe(true)
      expect(evaluate('+447987654321')).toBe(true)
    })

    test('should return false for invalid UK mobile numbers', () => {
      expect(evaluate('08123456789')).toBe(false)
      expect(evaluate('06123456789')).toBe(false)
      expect(evaluate('02012345678')).toBe(false)
      expect(evaluate('+44 20 1234 5678')).toBe(false)
      expect(evaluate('0712345678')).toBe(false)
      expect(evaluate('071234567890')).toBe(false)
      expect(evaluate('7123456789')).toBe(false)
      expect(evaluate('447123456789')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('notaphonenumber')).toBe(false)
    })

    test('should handle different UK mobile prefixes', () => {
      expect(evaluate('07123456789')).toBe(true)
      expect(evaluate('07423456789')).toBe(true)
      expect(evaluate('07523456789')).toBe(true)
      expect(evaluate('07623456789')).toBe(true)
      expect(evaluate('07723456789')).toBe(true)
      expect(evaluate('07823456789')).toBe(true)
      expect(evaluate('07923456789')).toBe(true)
    })

    test('should handle spacing variations', () => {
      expect(evaluate('07123456789')).toBe(true)
      expect(evaluate('07123 456789')).toBe(true)
      expect(evaluate('07123 456 789')).toBe(true)
      expect(evaluate('07123  456  789')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(7123456789)).toThrow('Condition.Phone.IsValidUKMobile expects a string but received number')
      expect(() => evaluate(null)).toThrow('Condition.Phone.IsValidUKMobile expects a string but received object')
      expect(() => evaluate(undefined)).toThrow(
        'Condition.Phone.IsValidUKMobile expects a string but received undefined',
      )
      expect(() => evaluate({})).toThrow('Condition.Phone.IsValidUKMobile expects a string but received object')
    })

    test('should build correct expression object', () => {
      const expr = PhoneConditions.IsValidUKMobile()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'isValidUKMobile',
        arguments: [],
      })
    })
  })
})
