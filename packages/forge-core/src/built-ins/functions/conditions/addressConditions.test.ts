import { AddressConditions, addressConditionsRegistry } from './addressConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('AddressConditions', () => {
  const harness = new FunctionRegistryTestHarness(addressConditionsRegistry)

  describe('IsValidPostcode', () => {
    test('should return true for valid UK postcodes', () => {
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A 1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('EC1A 1BB')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('EC1A1BB')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('W1A 0AX')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('W1A0AX')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('M1 1AE')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('M11AE')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('B33 8TH')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('B338TH')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('CR2 6XH')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('CR26XH')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('DN55 1PT')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('DN551PT')).toBe(true)
    })

    test('should be case insensitive', () => {
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('sw1a 1aa')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('Sw1A 1Aa')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A 1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('sw1a1aa')).toBe(true)
    })

    test('should handle different valid formats', () => {
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('N1 1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('N11 1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('NW1 1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('NW11 1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('N1W 1AA')).toBe(true)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('NW1W 1AA')).toBe(true)
    })

    test('should return false for invalid postcodes', () => {
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('1234567')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('ABC 123')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A 1')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A 1A')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A 1AAA')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW 1A 1AA')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1 A1AA')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('notapostcode')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('123 456')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A 111')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A AAA')).toBe(false)
    })

    test('should handle edge cases', () => {
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A  1AA')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput(' SW1A 1AA')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A 1AA ')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A-1AA')).toBe(false)
      expect(harness.evaluate(AddressConditions.IsValidPostcode()).withInput('SW1A.1AA')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = AddressConditions.IsValidPostcode()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Address.IsValidPostcode',
        arguments: [],
      })
    })
  })
})
