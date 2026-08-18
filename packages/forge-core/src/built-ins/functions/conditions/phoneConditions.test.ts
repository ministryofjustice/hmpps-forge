import { PhoneConditions, phoneConditionsRegistry } from './phoneConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('PhoneConditions', () => {
  const harness = new FunctionRegistryTestHarness(phoneConditionsRegistry)

  describe('IsValidPhoneNumber', () => {
    test('should return true for valid phone numbers', () => {
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('1234567')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('123-456-7890')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('(123) 456-7890')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('+1 234 567 8900')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('+44 20 7123 4567')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('020 7123 4567')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('123.456.7890')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('+1-234-567-8900')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('12345678901234567890')).toBe(true)
    })

    test('should return false for invalid phone numbers', () => {
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('123456')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('123456789012345678901')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('phone')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('123@456')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('++123456789')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('123#456#7890')).toBe(false)
    })

    test('should handle international formats', () => {
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('+1 (555) 123-4567')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('+44 20 7946 0958')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('+33 1 42 86 82 00')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidPhoneNumber()).withInput('+49 30 12345678')).toBe(true)
    })

    test('should build correct expression object', () => {
      const expr = PhoneConditions.IsValidPhoneNumber()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Phone.IsValidPhoneNumber',
        arguments: [],
      })
    })
  })

  describe('IsValidUKMobile', () => {
    test('should return true for valid UK mobile numbers', () => {
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123 456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123 456 789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('+447123456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('+44 7123 456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('+44 7123 456 789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('(07123) 456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('(07123) 456 789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07987654321')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('+447987654321')).toBe(true)
    })

    test('should return false for invalid UK mobile numbers', () => {
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('08123456789')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('06123456789')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('02012345678')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('+44 20 1234 5678')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('0712345678')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('071234567890')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('7123456789')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('447123456789')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('')).toBe(false)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('notaphonenumber')).toBe(false)
    })

    test('should handle different UK mobile prefixes', () => {
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07423456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07523456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07623456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07723456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07823456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07923456789')).toBe(true)
    })

    test('should handle spacing variations', () => {
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123 456789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123 456 789')).toBe(true)
      expect(harness.evaluate(PhoneConditions.IsValidUKMobile()).withInput('07123  456  789')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = PhoneConditions.IsValidUKMobile()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Phone.IsValidUKMobile',
        arguments: [],
      })
    })
  })
})
