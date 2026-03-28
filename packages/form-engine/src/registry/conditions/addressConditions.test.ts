import { AddressConditions, AddressConditionsRegistry } from './addressConditions'
import { FunctionType } from '../../form/types/enums'

describe('AddressConditions', () => {
  describe('IsValidPostcode', () => {
    const { evaluate } = AddressConditionsRegistry.IsValidPostcode

    test('should return true for valid UK postcodes', () => {
      expect(evaluate('SW1A 1AA')).toBe(true)
      expect(evaluate('SW1A1AA')).toBe(true)
      expect(evaluate('EC1A 1BB')).toBe(true)
      expect(evaluate('EC1A1BB')).toBe(true)
      expect(evaluate('W1A 0AX')).toBe(true)
      expect(evaluate('W1A0AX')).toBe(true)
      expect(evaluate('M1 1AE')).toBe(true)
      expect(evaluate('M11AE')).toBe(true)
      expect(evaluate('B33 8TH')).toBe(true)
      expect(evaluate('B338TH')).toBe(true)
      expect(evaluate('CR2 6XH')).toBe(true)
      expect(evaluate('CR26XH')).toBe(true)
      expect(evaluate('DN55 1PT')).toBe(true)
      expect(evaluate('DN551PT')).toBe(true)
    })

    test('should be case insensitive', () => {
      expect(evaluate('sw1a 1aa')).toBe(true)
      expect(evaluate('Sw1A 1Aa')).toBe(true)
      expect(evaluate('SW1A 1AA')).toBe(true)
      expect(evaluate('sw1a1aa')).toBe(true)
    })

    test('should handle different valid formats', () => {
      expect(evaluate('N1 1AA')).toBe(true)
      expect(evaluate('N11 1AA')).toBe(true)
      expect(evaluate('NW1 1AA')).toBe(true)
      expect(evaluate('NW11 1AA')).toBe(true)
      expect(evaluate('N1W 1AA')).toBe(true)
      expect(evaluate('NW1W 1AA')).toBe(true)
    })

    test('should return false for invalid postcodes', () => {
      expect(evaluate('1234567')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('ABC 123')).toBe(false)
      expect(evaluate('SW1A')).toBe(false)
      expect(evaluate('SW1A 1')).toBe(false)
      expect(evaluate('SW1A 1A')).toBe(false)
      expect(evaluate('SW1A 1AAA')).toBe(false)
      expect(evaluate('SW 1A 1AA')).toBe(false)
      expect(evaluate('SW1 A1AA')).toBe(false)
      expect(evaluate('notapostcode')).toBe(false)
      expect(evaluate('123 456')).toBe(false)
      expect(evaluate('SW1A 111')).toBe(false)
      expect(evaluate('SW1A AAA')).toBe(false)
    })

    test('should handle edge cases', () => {
      expect(evaluate('SW1A  1AA')).toBe(false)
      expect(evaluate(' SW1A 1AA')).toBe(false)
      expect(evaluate('SW1A 1AA ')).toBe(false)
      expect(evaluate('SW1A-1AA')).toBe(false)
      expect(evaluate('SW1A.1AA')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123456)).toThrow('Condition.Address.IsValidPostcode expects a string but received number')
      expect(() => evaluate(null)).toThrow('Condition.Address.IsValidPostcode expects a string but received object')
      expect(() => evaluate(undefined)).toThrow(
        'Condition.Address.IsValidPostcode expects a string but received undefined',
      )
      expect(() => evaluate([])).toThrow('Condition.Address.IsValidPostcode expects a string but received object')
      expect(() => evaluate({})).toThrow('Condition.Address.IsValidPostcode expects a string but received object')
      expect(() => evaluate(true)).toThrow('Condition.Address.IsValidPostcode expects a string but received boolean')
    })

    test('should build correct expression object', () => {
      const expr = AddressConditions.IsValidPostcode()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'IsValidPostcode',
        arguments: [],
      })
    })
  })
})
